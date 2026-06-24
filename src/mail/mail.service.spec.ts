import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { createMockPrisma } from '../common/testing/mocks.js';
import { MailService } from './mail.service.js';
import type { MailJobData } from '../queue/mail-queue.constants.js';

function createMockProvider() {
  return { send: jest.fn(async () => ({ id: 're_123' })) };
}

function createMockPublisher() {
  return { mailSent: jest.fn(async () => true) };
}

describe('MailService.deliver', () => {
  let db: ReturnType<typeof createMockPrisma>;
  let provider: ReturnType<typeof createMockProvider>;
  let publisher: ReturnType<typeof createMockPublisher>;
  let service: MailService;

  const job: MailJobData = {
    template: 'welcome',
    to: 'user@example.com',
    userId: 'u-1',
    eventId: randomUUID(),
    props: { name: 'Andrey', verifyUrl: 'https://app.example.com/verify' },
  };

  beforeEach(() => {
    db = createMockPrisma();
    provider = createMockProvider();
    publisher = createMockPublisher();
    service = new MailService(provider as any, db as any, publisher as any);
  });

  it('renders, sends via the provider and logs the delivery', async () => {
    const result = await service.deliver(job);

    expect(result).toEqual({ id: 're_123' });

    const sent = provider.send.mock.calls[0][0] as {
      to: string;
      subject: string;
      html: string;
    };
    expect(sent.to).toBe('user@example.com');
    expect(sent.subject).toMatch(/Welcome/);
    expect(sent.html).toContain('Verify email');

    expect((db.mailLog as any).create).toHaveBeenCalledWith({
      data: {
        userId: 'u-1',
        to: 'user@example.com',
        template: 'welcome',
        eventId: job.eventId,
        providerMessageId: 're_123',
        status: 'SENT',
      },
    });
    expect(publisher.mailSent).toHaveBeenCalledTimes(1);
  });

  it('does not re-send when the event was already delivered', async () => {
    (db.mailLog as any).findUnique.mockResolvedValueOnce({
      status: 'SENT',
      providerMessageId: 're_existing',
    });

    const result = await service.deliver(job);

    expect(result).toEqual({ id: 're_existing' });
    expect(provider.send).not.toHaveBeenCalled();
    expect((db.mailLog as any).create).not.toHaveBeenCalled();
  });

  it('propagates provider errors so the worker can retry', async () => {
    provider.send.mockRejectedValueOnce(new Error('Resend 500') as never);

    await expect(service.deliver(job)).rejects.toThrow('Resend 500');
    expect((db.mailLog as any).create).not.toHaveBeenCalled();
  });
});
