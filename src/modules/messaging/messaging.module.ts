import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { EventPublisher } from './event-publisher.service.js';
import { IdempotencyService } from './idempotency.service.js';
import { EVENTS_DLX, EVENTS_EXCHANGE } from './messaging.constants.js';

@Global()
@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        exchanges: [
          { name: EVENTS_EXCHANGE, type: 'topic' },
          { name: EVENTS_DLX, type: 'topic' },
        ],
        uri: config.getOrThrow<string>('RABBITMQ_URL'),
        connectionInitOptions: { wait: false },
        enableControllerDiscovery: true,
      }),
    }),
  ],
  providers: [EventPublisher, IdempotencyService],
  exports: [EventPublisher, IdempotencyService, RabbitMQModule],
})
export class MessagingModule {}
