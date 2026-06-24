import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import type { ConnectionOptions, Job } from 'bullmq';
import {
  BULLMQ_CONNECTION,
  MAIL_QUEUE,
  type MailJobData,
} from '../queue/mail-queue.constants.js';
import { MailService } from './mail.service.js';

/**
 * BullMQ worker that renders + sends queued mail. Rate-limited to the mail
 * provider's limits, retries are driven by the producer's job options, and the
 * worker drains active jobs on shutdown (graceful). Jobs that exhaust their
 * retries are logged as a dead-letter and retained (bounded) for diagnostics.
 */
@Injectable()
export class MailWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailWorkerService.name);
  private worker?: Worker<MailJobData>;

  constructor(
    @Inject(BULLMQ_CONNECTION) private readonly connection: ConnectionOptions,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  onModuleInit(): void {
    const max = this.config.get<number>('MAIL_RATE_MAX') ?? 2;
    const duration = this.config.get<number>('MAIL_RATE_DURATION') ?? 1000;

    this.worker = new Worker<MailJobData>(
      MAIL_QUEUE,
      async (job) => this.mail.deliver(job.data),
      {
        connection: this.connection,
        concurrency: max,
        limiter: { max, duration },
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed (eventId=${job.data.eventId})`);
    });

    this.worker.on('failed', (job, err) => {
      if (!job) {
        this.logger.error(`Job failed with no job ref: ${err.message}`);
        return;
      }
      const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
      const level = exhausted ? 'error' : 'warn';
      this.logger[level](
        JSON.stringify({
          msg: exhausted ? 'mail.dead_letter' : 'mail.retry',
          jobId: job.id,
          eventId: job.data.eventId,
          template: job.data.template,
          attempt: job.attemptsMade,
          maxAttempts: job.opts.attempts,
          error: err.message,
        }),
      );
      // On exhaustion the job is kept in the `failed` set (removeOnFail bound)
      // for inspection — that is our dead-letter sink.
    });
  }

  async onModuleDestroy(): Promise<void> {
    // Waits for active jobs to finish before resolving (graceful shutdown).
    await this.worker?.close();
  }

  /** Exposed for tests: the raw processor used by the worker. */
  process(job: Pick<Job<MailJobData>, 'data'>): Promise<{ id: string }> {
    return this.mail.deliver(job.data);
  }
}
