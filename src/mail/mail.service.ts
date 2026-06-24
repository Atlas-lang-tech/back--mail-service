import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import type { ConsumeMessage } from 'amqplib';
import { PrismaService } from '../modules/Prisma/prisma.service.js';
import { RedisService } from '../modules/redis/redis.service.js';
import { EventPublisher } from '../modules/messaging/event-publisher.service.js';
import { IdempotencyService } from '../modules/messaging/idempotency.service.js';
import {
  EVENTS_DLX,
  EVENTS_EXCHANGE,
  RoutingKey,
} from '../modules/messaging/messaging.constants.js';
import type {
  CoursePurchasedEvent,
  SubscriptionChangedEvent,
} from '../modules/messaging/messaging.constants.js';
import { TemplateService } from '../template/template.service.js';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private cacheKey = 'mail:';
  private ttl = 3600;

  constructor(
    private db: PrismaService,
    private cache: RedisService,
    private templates: TemplateService,
    private publisher: EventPublisher,
    private idempotency: IdempotencyService,
  ) {}

  // ---- reads (cache-aside) ----

  async findAll() {
    const key = `${this.cacheKey}all`;
    const cached = await this.cache.get(key);
    if (cached) return JSON.parse(cached);

    const data = await this.db.mailLog.findMany();
    await this.cache.set(key, JSON.stringify(data), this.ttl);
    return data;
  }

  async findById(id: number) {
    const key = `${this.cacheKey}${id}`;
    const cached = await this.cache.get(key);
    if (cached) return JSON.parse(cached);

    const log = await this.db.mailLog.findUnique({ where: { id } });
    await this.cache.set(key, JSON.stringify(log), this.ttl);
    return log;
  }

  async findForUser(userId: string) {
    const key = `${this.cacheKey}user-${userId}`;
    const cached = await this.cache.get(key);
    if (cached) return JSON.parse(cached);

    const data = await this.db.mailLog.findMany({ where: { userId } });
    await this.cache.set(key, JSON.stringify(data), this.ttl);
    return data;
  }

  // ---- consumers ----

  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: RoutingKey.CoursePurchased,
    queue: 'mail.delivery.course-purchased',
    queueOptions: { durable: true, deadLetterExchange: EVENTS_DLX },
  })
  async onCoursePurchased(
    event: CoursePurchasedEvent,
    amqpMsg: ConsumeMessage,
  ) {
    if (await this.idempotency.alreadyProcessed(amqpMsg.properties.messageId)) {
      return;
    }
    await this.deliver(event.userId, event.email, 'course-purchased');
  }

  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: RoutingKey.SubscriptionChanged,
    queue: 'mail.delivery.subscription-changed',
    queueOptions: { durable: true, deadLetterExchange: EVENTS_DLX },
  })
  async onSubscriptionChanged(
    event: SubscriptionChangedEvent,
    amqpMsg: ConsumeMessage,
  ) {
    if (await this.idempotency.alreadyProcessed(amqpMsg.properties.messageId)) {
      return;
    }
    await this.deliver(event.userId, event.email, 'subscription-changed');
  }

  // ---- delivery ----

  private async deliver(userId: string, to: string, templateTid: string) {
    const template = await this.templates.findByTid(templateTid);

    const log = await this.db.mailLog.create({
      data: { userId, to, templateTid, subject: template.subject },
    });

    // TODO: actual SMTP/provider send goes here.
    this.logger.log(`Sent "${templateTid}" to ${to} (user ${userId})`);

    await this.publisher.mailSent({
      userId,
      to,
      templateTid,
      sentAt: new Date().toISOString(),
    });

    await this.invalidate(userId);
    return log;
  }

  private async invalidate(userId: string) {
    await this.cache.del(`${this.cacheKey}all`);
    await this.cache.del(`${this.cacheKey}user-${userId}`);
  }
}
