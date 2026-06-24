// Shared ecosystem contract. Change routing keys / event shapes in lockstep
// with the other Atlas services.

export const EVENTS_EXCHANGE = 'atlas.events';
export const EVENTS_DLX = 'atlas.events.dlx';

export const RoutingKey = {
  // consumed by mail-service
  UserRegistered: 'user.registered',
  PasswordResetRequested: 'password.reset_requested',
  BillingPaymentSucceeded: 'billing.payment_succeeded',
  // published by mail-service
  MailSent: 'mail.sent',
} as const;

export type RoutingKey = (typeof RoutingKey)[keyof typeof RoutingKey];

// ---- consumed events ----
//
// Every consumed event carries a UUID `eventId` used for idempotency: the same
// `eventId` must never trigger a second email (see IdempotencyService).

export interface UserRegisteredEvent {
  eventId: string;
  userId: string;
  email: string;
  name?: string;
  verificationToken: string;
}

export interface PasswordResetRequestedEvent {
  eventId: string;
  userId: string;
  email: string;
  resetToken: string;
}

export interface PaymentSucceededEvent {
  eventId: string;
  userId: string;
  email: string;
  amount: number;
  currency: string;
  invoiceNumber: string;
  paidAt: string;
}

// ---- published events ----

export interface MailSentEvent {
  userId: string;
  to: string;
  template: string;
  providerMessageId: string;
  sentAt: string;
}
