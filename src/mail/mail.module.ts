import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../modules/Prisma/prisma.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { MailService } from './mail.service.js';
import { MailWorkerService } from './mail.worker.service.js';
import { MailEventsConsumer } from './mail-events.consumer.js';
import { MAIL_PROVIDER } from './providers/mail-provider.interface.js';
import { ResendMailProvider } from './providers/resend.provider.js';

/**
 * Wires the whole delivery pipeline:
 *  - MailEventsConsumer  — RabbitMQ → idempotent enqueue (BullMQ)
 *  - MailWorkerService   — dequeues, renders, sends
 *  - MailService         — orchestration + mail log
 *  - MAIL_PROVIDER       — vendor chosen via `MAIL_PROVIDER` config
 */
@Module({
  imports: [PrismaModule, QueueModule],
  providers: [
    MailService,
    MailWorkerService,
    MailEventsConsumer,
    ResendMailProvider,
    {
      provide: MAIL_PROVIDER,
      inject: [ConfigService, ResendMailProvider],
      useFactory: (config: ConfigService, resend: ResendMailProvider) => {
        const provider = config.get<string>('MAIL_PROVIDER') ?? 'resend';
        switch (provider) {
          case 'resend':
            return resend;
          // case 'ses': return ses; // future SesMailProvider, no consumer change
          default:
            throw new Error(`Unsupported MAIL_PROVIDER: ${provider}`);
        }
      },
    },
  ],
})
export class MailModule {}
