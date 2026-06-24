import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from '@golevelup/nestjs-rabbitmq';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { IdempotencyService } from '../modules/messaging/idempotency.service.js';
import {
  EVENTS_DLX,
  EVENTS_EXCHANGE,
  RoutingKey,
} from '../modules/messaging/messaging.constants.js';
import { UserRegisteredDto } from '../modules/messaging/dto/user-registered.dto.js';
import { PasswordResetRequestedDto } from '../modules/messaging/dto/password-reset-requested.dto.js';
import { PaymentSucceededDto } from '../modules/messaging/dto/payment-succeeded.dto.js';
import { MailQueueProducer } from '../queue/mail-queue.producer.js';
import type { MailJobData } from '../queue/mail-queue.constants.js';

/**
 * RabbitMQ entrypoint. Validates each domain event, guards against duplicates by
 * `eventId` (Redis SETNX) and enqueues a BullMQ job. It performs NO sending —
 * rendering and delivery happen in the worker. Invalid payloads are NACKed to
 * the dead-letter exchange.
 */
@Injectable()
export class MailEventsConsumer {
  private readonly logger = new Logger(MailEventsConsumer.name);

  constructor(
    private readonly config: ConfigService,
    private readonly idempotency: IdempotencyService,
    private readonly producer: MailQueueProducer,
  ) {}

  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: RoutingKey.UserRegistered,
    queue: 'mail.delivery.user-registered',
    queueOptions: { durable: true, deadLetterExchange: EVENTS_DLX },
    errorBehavior: MessageHandlerErrorBehavior.NACK,
  })
  async onUserRegistered(payload: unknown): Promise<void> {
    const dto = await this.validate(UserRegisteredDto, payload);
    const verifyUrl = `${this.baseUrl()}/verify-email?token=${encodeURIComponent(dto.verificationToken)}`;
    await this.dispatch(dto.eventId, {
      template: 'welcome',
      to: dto.email,
      userId: dto.userId,
      eventId: dto.eventId,
      props: { name: dto.name, verifyUrl },
    });
  }

  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: RoutingKey.PasswordResetRequested,
    queue: 'mail.delivery.password-reset-requested',
    queueOptions: { durable: true, deadLetterExchange: EVENTS_DLX },
    errorBehavior: MessageHandlerErrorBehavior.NACK,
  })
  async onPasswordResetRequested(payload: unknown): Promise<void> {
    const dto = await this.validate(PasswordResetRequestedDto, payload);
    const resetUrl = `${this.baseUrl()}/reset-password?token=${encodeURIComponent(dto.resetToken)}`;
    await this.dispatch(dto.eventId, {
      template: 'password-reset',
      to: dto.email,
      userId: dto.userId,
      eventId: dto.eventId,
      props: { resetUrl },
    });
  }

  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: RoutingKey.BillingPaymentSucceeded,
    queue: 'mail.delivery.payment-succeeded',
    queueOptions: { durable: true, deadLetterExchange: EVENTS_DLX },
    errorBehavior: MessageHandlerErrorBehavior.NACK,
  })
  async onPaymentSucceeded(payload: unknown): Promise<void> {
    const dto = await this.validate(PaymentSucceededDto, payload);
    await this.dispatch(dto.eventId, {
      template: 'payment-succeeded',
      to: dto.email,
      userId: dto.userId,
      eventId: dto.eventId,
      props: {
        invoiceNumber: dto.invoiceNumber,
        amountFormatted: this.formatAmount(dto.amount, dto.currency),
        paidAt: this.formatDate(dto.paidAt),
      },
    });
  }

  // ---- helpers ----

  private async validate<T extends object>(
    cls: new () => T,
    payload: unknown,
  ): Promise<T> {
    const dto = plainToInstance(cls, payload);
    await validateOrReject(dto as object); // invalid → throw → NACK → DLX
    return dto;
  }

  /** Idempotent enqueue: skip if this eventId was already seen. */
  private async dispatch(eventId: string, job: MailJobData): Promise<void> {
    if (await this.idempotency.alreadyProcessed(eventId)) {
      this.logger.log(`Duplicate event ${eventId} — skipping enqueue`);
      return;
    }
    await this.producer.enqueue(job);
  }

  private baseUrl(): string {
    return this.config.getOrThrow<string>('APP_BASE_URL').replace(/\/+$/, '');
  }

  private formatAmount(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  }

  private formatDate(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? iso
      : new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(date);
  }
}
