import { ConflictException, NotFoundException } from '@nestjs/common';
import { createMockPrisma, createMockRedis } from '../common/testing/mocks.js';
import { TemplateService } from './template.service.js';

describe('TemplateService', () => {
  let service: TemplateService;
  let db: ReturnType<typeof createMockPrisma>;
  let cache: ReturnType<typeof createMockRedis>;

  const template = {
    id: 1,
    tid: 'welcome',
    subject: 'Welcome',
    body: 'Hello {{name}}',
    isActive: true,
  };

  beforeEach(() => {
    db = createMockPrisma();
    cache = createMockRedis();
    service = new TemplateService(db as any, cache as any);
  });

  describe('findAll', () => {
    it('returns cached value on cache hit without hitting the db', async () => {
      cache.get.mockResolvedValueOnce(JSON.stringify([template]) as never);

      const result = await service.findAll();

      expect(result).toEqual([template]);
      expect((db.emailTemplate as any).findMany).not.toHaveBeenCalled();
    });

    it('reads from db and populates cache on cache miss', async () => {
      (db.emailTemplate as any).findMany.mockResolvedValueOnce([template]);

      const result = await service.findAll();

      expect(result).toEqual([template]);
      expect(cache.set).toHaveBeenCalledWith(
        'template:all',
        JSON.stringify([template]),
        3600,
      );
    });
  });

  describe('findById', () => {
    it('throws NotFoundException when missing', async () => {
      (db.emailTemplate as any).findUnique.mockResolvedValueOnce(null);

      await expect(service.findById(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('throws ConflictException when tid already exists', async () => {
      (db.emailTemplate as any).findUnique.mockResolvedValueOnce(template);

      await expect(
        service.create({ tid: 'welcome', subject: 'x', body: 'y' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates and invalidates cache', async () => {
      (db.emailTemplate as any).findUnique.mockResolvedValueOnce(null);
      (db.emailTemplate as any).create.mockResolvedValueOnce(template);

      const result = await service.create({
        tid: 'welcome',
        subject: 'Welcome',
        body: 'Hello {{name}}',
      });

      expect(result).toEqual(template);
      expect(cache.del).toHaveBeenCalledWith('template:all');
      expect(cache.del).toHaveBeenCalledWith('template:1');
      expect(cache.del).toHaveBeenCalledWith('template:welcome');
    });
  });

  describe('remove', () => {
    it('deletes and returns a success message', async () => {
      (db.emailTemplate as any).findUnique.mockResolvedValueOnce(template);
      (db.emailTemplate as any).delete.mockResolvedValueOnce(template);

      const result = await service.remove(1);

      expect(result).toEqual({ message: 'Template deleted successfully' });
      expect((db.emailTemplate as any).delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
  });
});
