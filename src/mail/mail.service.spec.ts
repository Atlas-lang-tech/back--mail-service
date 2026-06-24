import { jest } from '@jest/globals';
import { createMockPrisma, createMockRedis } from '../common/testing/mocks.js';
import { MailService } from './mail.service.js';

function createMockTemplates() {
  return {
    findByTid: jest.fn(async () => ({
      id: 1,
      tid: 'course-purchased',
      subject: 'Your course',
      body: 'Thanks',
      isActive: true,
    })),
  };
}

function createMockPublisher() {
  return { mailSent: jest.fn(async () => true) };
}

function createMockIdempotency() {
  return { alreadyProcessed: jest.fn(async () => false) };
}

function amqpMsg(messageId?: string) {
  return { properties: { messageId } } as any;
}

describe('MailService', () => {
  let service: MailService;
  let db: ReturnType<typeof createMockPrisma>;
  let cache: ReturnType<typeof createMockRedis>;
  let templates: ReturnType<typeof createMockTemplates>;
  let publisher: ReturnType<typeof createMockPublisher>;
  let idempotency: ReturnType<typeof createMockIdempotency>;

  const event = {
    userId: 'u-1',
    email: 'u1@example.com',
    courseId: 7,
    courseTitle: 'Algebra',
    purchasedAt: '2026-06-24T00:00:00.000Z',
  };

  beforeEach(() => {
    db = createMockPrisma();
    cache = createMockRedis();
    templates = createMockTemplates();
    publisher = createMockPublisher();
    idempotency = createMockIdempotency();
    service = new MailService(
      db as any,
      cache as any,
      templates as any,
      publisher as any,
      idempotency as any,
    );
  });

  describe('onCoursePurchased', () => {
    it('skips when the event was already processed', async () => {
      idempotency.alreadyProcessed.mockResolvedValueOnce(true);

      await service.onCoursePurchased(event, amqpMsg('m-1'));

      expect((db.mailLog as any).create).not.toHaveBeenCalled();
      expect(publisher.mailSent).not.toHaveBeenCalled();
    });

    it('logs delivery, publishes mail.sent and invalidates cache', async () => {
      (db.mailLog as any).create.mockResolvedValueOnce({ id: 10 });

      await service.onCoursePurchased(event, amqpMsg('m-2'));

      expect(templates.findByTid).toHaveBeenCalledWith('course-purchased');
      expect((db.mailLog as any).create).toHaveBeenCalledWith({
        data: {
          userId: 'u-1',
          to: 'u1@example.com',
          templateTid: 'course-purchased',
          subject: 'Your course',
        },
      });
      expect(publisher.mailSent).toHaveBeenCalledTimes(1);
      expect(cache.del).toHaveBeenCalledWith('mail:all');
      expect(cache.del).toHaveBeenCalledWith('mail:user-u-1');
    });
  });

  describe('findForUser', () => {
    it('returns cached value without hitting the db', async () => {
      cache.get.mockResolvedValueOnce(JSON.stringify([{ id: 1 }]) as never);

      const result = await service.findForUser('u-1');

      expect(result).toEqual([{ id: 1 }]);
      expect((db.mailLog as any).findMany).not.toHaveBeenCalled();
    });
  });
});
