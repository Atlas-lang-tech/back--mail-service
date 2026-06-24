import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type {
  MailProvider,
  SendMailMessage,
  SendMailResult,
} from './mail-provider.interface.js';

/** Resend implementation of {@link MailProvider} (official `resend` SDK). */
@Injectable()
export class ResendMailProvider implements MailProvider {
  private readonly logger = new Logger(ResendMailProvider.name);
  private readonly client: Resend;
  private readonly defaultFrom: string;

  constructor(config: ConfigService) {
    this.client = new Resend(config.getOrThrow<string>('RESEND_API_KEY'));
    this.defaultFrom = config.getOrThrow<string>('MAIL_FROM');
  }

  async send(msg: SendMailMessage): Promise<SendMailResult> {
    const { data, error } = await this.client.emails.send({
      from: msg.from ?? this.defaultFrom,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
    });

    // Surface provider errors so BullMQ retries with backoff.
    if (error || !data) {
      this.logger.error(`Resend send failed: ${error?.message ?? 'no data'}`);
      throw new Error(error?.message ?? 'Resend returned no data');
    }

    return { id: data.id };
  }
}
