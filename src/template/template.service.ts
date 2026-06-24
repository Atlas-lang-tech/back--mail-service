import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../modules/Prisma/prisma.service.js';
import { RedisService } from '../modules/redis/redis.service.js';
import { CreateTemplateDto } from './dto/create-template.dto.js';
import { UpdateTemplateDto } from './dto/update-template.dto.js';

type EmailTemplate = {
  id: number;
  tid: string;
  subject: string;
  body: string;
  isActive: boolean;
};

@Injectable()
export class TemplateService {
  private cacheKey = 'template:';
  private ttl = 3600;

  constructor(
    private db: PrismaService,
    private cache: RedisService,
  ) {}

  async findAll() {
    const key = `${this.cacheKey}all`;
    const cached = await this.cache.get(key);
    if (cached) return JSON.parse(cached);

    const data = await this.db.emailTemplate.findMany();
    await this.cache.set(key, JSON.stringify(data), this.ttl);
    return data;
  }

  async findById(id: number) {
    const key = `${this.cacheKey}${id}`;
    const cached = await this.cache.get(key);
    if (cached) return JSON.parse(cached);

    const template = await this.db.emailTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');

    await this.cache.set(key, JSON.stringify(template), this.ttl);
    return template;
  }

  async findByTid(tid: string) {
    const key = `${this.cacheKey}${tid}`;
    const cached = await this.cache.get(key);
    if (cached) return JSON.parse(cached);

    const template = await this.db.emailTemplate.findUnique({ where: { tid } });
    if (!template) throw new NotFoundException('Template not found');

    await this.cache.set(key, JSON.stringify(template), this.ttl);
    return template;
  }

  async create(dto: CreateTemplateDto) {
    const exists = await this.db.emailTemplate.findUnique({
      where: { tid: dto.tid },
    });
    if (exists) throw new ConflictException('Template already exists');

    const template = await this.db.emailTemplate.create({ data: dto });
    await this.invalidate(template);
    return template;
  }

  async update(id: number, dto: UpdateTemplateDto) {
    const oldTemplate = await this.db.emailTemplate.findUnique({
      where: { id },
    });
    if (!oldTemplate) throw new NotFoundException('Template not found');

    const updated = await this.db.emailTemplate.update({
      where: { id },
      data: dto,
    });

    await this.invalidate(oldTemplate);
    await this.invalidate(updated);
    return updated;
  }

  async remove(id: number) {
    const template = await this.db.emailTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');

    await this.db.emailTemplate.delete({ where: { id } });
    await this.invalidate(template);
    return { message: 'Template deleted successfully' };
  }

  private async invalidate(template: EmailTemplate) {
    await this.cache.del(`${this.cacheKey}all`);
    await this.cache.del(`${this.cacheKey}${template.id}`);
    await this.cache.del(`${this.cacheKey}${template.tid}`);
  }
}
