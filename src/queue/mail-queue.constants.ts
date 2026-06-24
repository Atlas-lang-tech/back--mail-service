/** BullMQ queue + job contract for asynchronous mail delivery. */

export const MAIL_QUEUE = 'mail-delivery';
export const MAIL_JOB = 'send-mail';

/** DI token for the shared ioredis connection options used by BullMQ. */
export const BULLMQ_CONNECTION = Symbol('BULLMQ_CONNECTION');

/** Template identifiers — one per supported transactional email. */
export type TemplateKey = 'welcome' | 'password-reset' | 'payment-succeeded';

/** Data carried by a single mail-delivery job. */
export interface MailJobData {
  template: TemplateKey;
  /** Typed template props (derived from the originating event payload). */
  props: Record<string, unknown>;
  to: string;
  /** Recipient user id — persisted on the mail log. */
  userId: string;
  /** Source event id — used for idempotency and structured logging. */
  eventId: string;
}
