import { jest } from '@jest/globals';
import { MAIL_QUEUE, type MailJobData } from '../queue/mail-queue.constants.js';

// ---- ESM module mock for bullmq Worker ----
// Capture the processor fn, the registered event handlers and the constructor
// options so we can drive them directly without a real Redis/BullMQ.
type Handler = (...args: any[]) => void;

let processor: (job: { data: MailJobData }) => Promise<unknown>;
const handlers: Record<string, Handler> = {};
const workerMock = {
  on: jest.fn((event: string, cb: Handler) => {
    handlers[event] = cb;
    return workerMock;
  }),
  close: jest.fn<() => Promise<void>>(async () => undefined),
};
const WorkerCtor = jest.fn().mockImplementation((_q: string, fn: any) => {
  processor = fn;
  return workerMock;
});

jest.unstable_mockModule('bullmq', () => ({ Worker: WorkerCtor }));

const { MailWorkerService } = await import('./mail.worker.service.js');

function createConfig(values: Record<string, number> = {}) {
  return { get: jest.fn((k: string) => values[k]) };
}

const connection = { host: 'localhost', port: 6379 } as any;

const sampleData: MailJobData = {
  template: 'welcome',
  to: 'user@example.com',
  userId: 'u-1',
  eventId: 'evt-1',
  props: {},
};

describe('MailWorkerService', () => {
  let deliver: jest.Mock<(d: MailJobData) => Promise<{ id: string }>>;

  beforeEach(() => {
    WorkerCtor.mockClear();
    workerMock.on.mockClear();
    workerMock.close.mockClear();
    for (const k of Object.keys(handlers)) delete handlers[k];
    deliver = jest.fn(async () => ({ id: 're_1' }));
  });

  function makeService(config = createConfig()) {
    return new MailWorkerService(connection, config as any, { deliver } as any);
  }

  it('process() delegates to MailService.deliver', async () => {
    const service = makeService();
    await expect(service.process({ data: sampleData })).resolves.toEqual({
      id: 're_1',
    });
    expect(deliver).toHaveBeenCalledWith(sampleData);
  });

  it('onModuleInit wires the worker with default rate limits', () => {
    makeService().onModuleInit();

    expect(WorkerCtor).toHaveBeenCalledTimes(1);
    const [queueName, , opts] = WorkerCtor.mock.calls[0] as any[];
    expect(queueName).toBe(MAIL_QUEUE);
    expect(opts).toMatchObject({
      connection,
      concurrency: 2,
      limiter: { max: 2, duration: 1000 },
    });
  });

  it('onModuleInit honours configured rate limits', () => {
    const config = createConfig({ MAIL_RATE_MAX: 5, MAIL_RATE_DURATION: 2000 });
    makeService(config).onModuleInit();

    const [, , opts] = WorkerCtor.mock.calls[0] as any[];
    expect(opts).toMatchObject({
      concurrency: 5,
      limiter: { max: 5, duration: 2000 },
    });
  });

  it('the processor calls MailService.deliver with the job data', async () => {
    makeService().onModuleInit();
    await processor({ data: sampleData });
    expect(deliver).toHaveBeenCalledWith(sampleData);
  });

  it('logs a retry (warn) while attempts remain', () => {
    const service = makeService();
    service.onModuleInit();
    const warn = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);

    handlers['failed'](
      { id: 'j1', data: sampleData, attemptsMade: 2, opts: { attempts: 5 } },
      new Error('boom'),
    );

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('mail.retry');
  });

  it('logs a dead-letter (error) once attempts are exhausted', () => {
    const service = makeService();
    service.onModuleInit();
    const error = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => undefined);

    handlers['failed'](
      { id: 'j1', data: sampleData, attemptsMade: 5, opts: { attempts: 5 } },
      new Error('boom'),
    );

    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain('mail.dead_letter');
  });

  it('logs when a failed event has no job reference', () => {
    const service = makeService();
    service.onModuleInit();
    const error = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => undefined);

    handlers['failed'](undefined, new Error('orphan'));

    expect(error).toHaveBeenCalledWith(expect.stringContaining('no job ref'));
  });

  it('logs successful completion', () => {
    const service = makeService();
    service.onModuleInit();
    const log = jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => undefined);

    handlers['completed']({ id: 'j1', data: sampleData });

    expect(log).toHaveBeenCalledWith(expect.stringContaining('completed'));
  });

  it('closes the worker on module destroy', async () => {
    const service = makeService();
    service.onModuleInit();
    await service.onModuleDestroy();
    expect(workerMock.close).toHaveBeenCalledTimes(1);
  });
});
