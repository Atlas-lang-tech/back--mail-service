import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../modules/Prisma/prisma.service.js';
import { EventPublisher } from '../modules/messaging/event-publisher.service.js';
import {
  MAIL_PROVIDER,
  type MailProvider,
} from './providers/mail-provider.interface.js';
import { renderTemplate, subjectFor } from './templates/render.js';
import type { MailJobData } from '../queue/mail-queue.constants.js';

/**
 * Orchestrates a single delivery: render template → send via provider →
 * persist a mail log → publish `mail.sent`. Provider failures propagate so the
 * BullMQ worker retries them with backoff.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_PROVIDER) private readonly provider: MailProvider,
    private readonly db: PrismaService,
    private readonly publisher: EventPublisher,
  ) {}

  async deliver(data: MailJobData): Promise<{ id: string }> {
    // Guard against a re-send if a job retries after the provider already
    // accepted the message (e.g. a post-send step failed). The unique eventId
    // on the mail log is our "already delivered" marker.
    const existing = await this.db.mailLog.findUnique({
      where: { eventId: data.eventId },
    });
    if (existing?.status === 'SENT') {
      this.logger.log(
        `Mail for event ${data.eventId} already sent — skipping re-send`,
      );
      return { id: existing.providerMessageId ?? '' };
    }

    const html = await renderTemplate(data.template, data.props);
    const subject = subjectFor(data.template);

    const { id: providerMessageId } = await this.provider.send({
      to: data.to,
      subject,
      html,
    });

    await this.db.mailLog.create({
      data: {
        userId: data.userId,
        to: data.to,
        template: data.template,
        eventId: data.eventId,
        providerMessageId,
        status: 'SENT',
      },
    });

    this.logger.log(
      JSON.stringify({
        msg: 'mail.sent',
        eventId: data.eventId,
        template: data.template,
        to: data.to,
        providerMessageId,
        status: 'SENT',
      }),
    );

    await this.publisher.mailSent({
      userId: data.userId,
      to: data.to,
      template: data.template,
      providerMessageId,
      sentAt: new Date().toISOString(),
    });

    return { id: providerMessageId };
  }
}
