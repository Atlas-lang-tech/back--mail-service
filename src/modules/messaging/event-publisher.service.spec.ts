import { jest } from '@jest/globals';
import { EventPublisher } from './event-publisher.service.js';
import {
  EVENTS_EXCHANGE,
  MailSentEvent,
  RoutingKey,
} from './messaging.constants.js';

function createMockAmqp() {
  return { publish: jest.fn(async () => undefined) };
}

describe('EventPublisher.mailSent', () => {
  it('publishes mail.sent to the events exchange with durable options', async () => {
    const amqp = createMockAmqp();
    const publisher = new EventPublisher(amqp as any);

    const event: MailSentEvent = {
      userId: 'u-1',
      to: 'user@example.com',
      template: 'welcome',
      providerMessageId: 're_123',
      sentAt: '2026-06-25T10:00:00.000Z',
    };

    await publisher.mailSent(event);

    expect(amqp.publish).toHaveBeenCalledTimes(1);
    const [exchange, routingKey, payload, options] = amqp.publish.mock
      .calls[0] as any[];

    expect(exchange).toBe(EVENTS_EXCHANGE);
    expect(routingKey).toBe(RoutingKey.MailSent);
    expect(payload).toEqual(event);
    expect(options).toMatchObject({
      persistent: true,
      contentType: 'application/json',
    });
    expect(typeof options.messageId).toBe('string');
    expect(options.messageId.length).toBeGreaterThan(0);
  });
});
