import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import {
  EVENTS_EXCHANGE,
  MailSentEvent,
  RoutingKey,
} from './messaging.constants.js';

@Injectable()
export class EventPublisher {
  constructor(private readonly amqp: AmqpConnection) {}

  mailSent(event: MailSentEvent) {
    return this.publish(RoutingKey.MailSent, event);
  }

  private publish(routingKey: string, payload: unknown) {
    return this.amqp.publish(EVENTS_EXCHANGE, routingKey, payload, {
      persistent: true,
      messageId: randomUUID(),
      contentType: 'application/json',
    });
  }
}
