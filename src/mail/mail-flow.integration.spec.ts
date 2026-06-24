import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { createMockPrisma } from '../common/testing/mocks.js';
import { MailEventsConsumer } from './mail-events.consumer.js';
import { MailService } from './mail.service.js';
import type { MailJobData } from '../queue/mail-queue.constants.js';

/**
 * Integration of the full in-process chain (provider mocked):
 *   RabbitMQ event → consumer → enqueued MailJobData → worker/MailService.deliver
 *   → provider.send.
 * Per CONVENTIONS §14 this stays at the method level (no live RabbitMQ/Redis);
 * a real broker integration is exercised manually via docker compose.
 */
describe('mail flow (event → queue → provider)', () => {
  it('turns a user.registered event into a single provider send', async () => {
    // 1. consumer enqueues
    const enqueued: MailJobData[] = [];
    const producer = {
      enqueue: jest.fn(async (data: MailJobData) => {
        enqueued.push(data);
      }),
    };
    const consumer = new MailEventsConsumer(
      { getOrThrow: () => 'https://app.example.com' } as any,
      { alreadyProcessed: jest.fn(async () => false) } as any,
      producer as any,
    );

    const eventId = randomUUID();
    await consumer.onUserRegistered({
      eventId,
      userId: 'u-42',
      email: 'new@example.com',
      name: 'Pat',
      verificationToken: 'vt-1',
    });

    expect(enqueued).toHaveLength(1);

    // 2. worker delivers the enqueued job
    const provider = { send: jest.fn(async () => ({ id: 're_flow' })) };
    const db = createMockPrisma();
    const publisher = { mailSent: jest.fn(async () => true) };
    const mail = new MailService(provider as any, db as any, publisher as any);

    const result = await mail.deliver(enqueued[0]);

    expect(result).toEqual({ id: 're_flow' });
    expect(provider.send).toHaveBeenCalledTimes(1);
    const sent = (provider.send.mock.calls[0] as any[])[0];
    expect(sent.to).toBe('new@example.com');
    expect(sent.html).toContain('vt-1');
    expect((db.mailLog as any).create).toHaveBeenCalledTimes(1);
  });
});
