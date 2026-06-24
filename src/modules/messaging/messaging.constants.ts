// Shared ecosystem contract. Change routing keys / event shapes in lockstep
// with the other Atlas services.

export const EVENTS_EXCHANGE = 'atlas.events';
export const EVENTS_DLX = 'atlas.events.dlx';

export const RoutingKey = {
  // consumed by mail-service
  CoursePurchased: 'course.purchased',
  SubscriptionChanged: 'subscription.changed',
  // published by mail-service
  MailSent: 'mail.sent',
} as const;

export type RoutingKey = (typeof RoutingKey)[keyof typeof RoutingKey];

// ---- consumed events ----

export interface CoursePurchasedEvent {
  userId: string;
  email: string;
  courseId: number;
  courseTitle: string;
  purchasedAt: string;
}

export interface SubscriptionChangedEvent {
  userId: string;
  email: string;
  plan: string;
  changedAt: string;
}

// ---- published events ----

export interface MailSentEvent {
  userId: string;
  to: string;
  templateTid: string;
  sentAt: string;
}
