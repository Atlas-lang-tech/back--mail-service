import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { MailEventsConsumer } from './mail-events.consumer.js';

function createMockConfig() {
  return { getOrThrow: jest.fn(() => 'https://app.example.com') };
}

function createMockIdempotency(duplicate = false) {
  return { alreadyProcessed: jest.fn(async () => duplicate) };
}

function createMockProducer() {
  return { enqueue: jest.fn(async () => undefined) };
}

describe('MailEventsConsumer', () => {
  it('enqueues a welcome job with a verification link', async () => {
    const idempotency = createMockIdempotency(false);
    const producer = createMockProducer();
    const consumer = new MailEventsConsumer(
      createMockConfig() as any,
      idempotency as any,
      producer as any,
    );
    const eventId = randomUUID();

    await consumer.onUserRegistered({
      eventId,
      userId: 'u-1',
      email: 'user@example.com',
      name: 'Andrey',
      verificationToken: 'verify-tok',
    });

    expect(producer.enqueue).toHaveBeenCalledWith({
      template: 'welcome',
      to: 'user@example.com',
      userId: 'u-1',
      eventId,
      props: {
        name: 'Andrey',
        verifyUrl: 'https://app.example.com/verify-email?token=verify-tok',
      },
    });
  });

  it('is idempotent: a duplicate eventId does not enqueue again', async () => {
    const idempotency = createMockIdempotency(true); // already seen
    const producer = createMockProducer();
    const consumer = new MailEventsConsumer(
      createMockConfig() as any,
      idempotency as any,
      producer as any,
    );

    await consumer.onUserRegistered({
      eventId: randomUUID(),
      userId: 'u-1',
      email: 'user@example.com',
      verificationToken: 'verify-tok',
    });

    expect(producer.enqueue).not.toHaveBeenCalled();
  });

  it('rejects (→ DLX) an invalid payload', async () => {
    const producer = createMockProducer();
    const consumer = new MailEventsConsumer(
      createMockConfig() as any,
      createMockIdempotency(false) as any,
      producer as any,
    );

    await expect(
      consumer.onUserRegistered({ email: 'not-an-email' }),
    ).rejects.toBeDefined();
    expect(producer.enqueue).not.toHaveBeenCalled();
  });

  it('formats the payment receipt props', async () => {
    const producer = createMockProducer();
    const consumer = new MailEventsConsumer(
      createMockConfig() as any,
      createMockIdempotency(false) as any,
      producer as any,
    );
    const eventId = randomUUID();

    await consumer.onPaymentSucceeded({
      eventId,
      userId: 'u-9',
      email: 'buyer@example.com',
      amount: 19.99,
      currency: 'USD',
      invoiceNumber: 'INV-2026-001',
      paidAt: '2026-06-24T10:00:00.000Z',
    });

    const job = (producer.enqueue.mock.calls[0] as any[])[0];
    expect(job.template).toBe('payment-succeeded');
    expect(job.props.invoiceNumber).toBe('INV-2026-001');
    expect(job.props.amountFormatted).toContain('19.99');
    expect(job.props.paidAt).toMatch(/2026/);
  });
});
