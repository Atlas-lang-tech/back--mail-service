/** DI token used to inject the active mail provider. */
export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');

export interface SendMailMessage {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface SendMailResult {
  id: string;
}

/**
 * Provider-agnostic mail transport. Implementations (Resend today, SES later)
 * are selected via the {@link MAIL_PROVIDER} token + `MAIL_PROVIDER` config, so
 * business logic never depends on a concrete vendor.
 */
export interface MailProvider {
  send(msg: SendMailMessage): Promise<SendMailResult>;
}
