import { jest } from '@jest/globals';
import { MAIL_JOB, MAIL_QUEUE, MailJobData } from './mail-queue.constants.js';

// ---- ESM module mock for bullmq Queue ----
const queueMock = {
  add: jest.fn<(...a: any[]) => Promise<unknown>>(async () => ({})),
  close: jest.fn<() => Promise<void>>(async () => undefined),
};
const QueueCtor = jest.fn().mockImplementation(() => queueMock);

jest.unstable_mockModule('bullmq', () => ({ Queue: QueueCtor }));

const { MailQueueProducer } = await import('./mail-queue.producer.js');

const connection = { host: 'localhost', port: 6379 } as any;

const job: MailJobData = {
  template: 'welcome',
  to: 'user@example.com',
  userId: 'u-1',
  eventId: 'evt-123',
  props: { name: 'Andrey' },
};

describe('MailQueueProducer', () => {
  beforeEach(() => {
    queueMock.add.mockClear();
    queueMock.close.mockClear();
    QueueCtor.mockClear();
  });

  it('creates the queue with the retry/retention policy', () => {
    new MailQueueProducer(connection);

    expect(QueueCtor).toHaveBeenCalledWith(MAIL_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: { count: 1000 },
      },
    });
  });

  it('enqueues using the eventId as the jobId (dedupe)', async () => {
    const producer = new MailQueueProducer(connection);

    await producer.enqueue(job);

    expect(queueMock.add).toHaveBeenCalledWith(MAIL_JOB, job, {
      jobId: 'evt-123',
    });
  });

  it('closes the queue on module destroy', async () => {
    const producer = new MailQueueProducer(connection);

    await producer.onModuleDestroy();

    expect(queueMock.close).toHaveBeenCalledTimes(1);
  });
});
