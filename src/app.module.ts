import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './common/env.validation.js';
import { HealthController } from './common/health/health.controller.js';
import { PrismaModule } from './modules/Prisma/prisma.module.js';
import { RedisModule } from './modules/redis/redis.module.js';
import { MessagingModule } from './modules/messaging/messaging.module.js';
import { QueueModule } from './queue/queue.module.js';
import { MailModule } from './mail/mail.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    PrismaModule,
    RedisModule,
    MessagingModule,
    QueueModule,
    MailModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
