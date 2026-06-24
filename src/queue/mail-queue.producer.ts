import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import {
  BULLMQ_CONNECTION,
  MAIL_JOB,
  MAIL_QUEUE,
  MailJobData,
} from './mail-queue.constants.js';

/**
 * Owns the BullMQ queue and pushes mail-delivery jobs. Default job options
 * implement the retry / retention policy required by the service:
 *  - 5 attempts, exponential backoff starting at 2s;
 *  - completed jobs removed immediately;
 *  - failed jobs kept (bounded) for diagnostics.
 */
@Injectable()
export class MailQueueProducer implements OnModuleDestroy {
  private readonly logger = new Logger(MailQueueProducer.name);
  private readonly queue: Queue<MailJobData>;

  constructor(@Inject(BULLMQ_CONNECTION) connection: ConnectionOptions) {
    this.queue = new Queue<MailJobData>(MAIL_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: { count: 1000 },
      },
    });
  }

  async enqueue(data: MailJobData): Promise<void> {
    // Use the eventId as the BullMQ jobId so a duplicate that slips past the
    // Redis idempotency guard still collapses into a single job.
    await this.queue.add(MAIL_JOB, data, { jobId: data.eventId });
    this.logger.log(
      `Enqueued mail job template=${data.template} eventId=${data.eventId}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
