import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConnectionOptions } from 'bullmq';
import { BULLMQ_CONNECTION } from './mail-queue.constants.js';
import { MailQueueProducer } from './mail-queue.producer.js';

/**
 * Provides the shared BullMQ/ioredis connection and the queue producer.
 * BullMQ requires `maxRetriesPerRequest: null`, so we build a dedicated
 * connection rather than reusing RedisService.
 */
@Module({
  providers: [
    {
      provide: BULLMQ_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ConnectionOptions => ({
        host: config.getOrThrow<string>('REDIS_HOST'),
        port: config.getOrThrow<number>('REDIS_PORT'),
        db: config.getOrThrow<number>('REDIS_DB'),
        password: config.get<string>('REDIS_PASSWORD') || undefined,
        maxRetriesPerRequest: null,
      }),
    },
    MailQueueProducer,
  ],
  exports: [BULLMQ_CONNECTION, MailQueueProducer],
})
export class QueueModule {}
