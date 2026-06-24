import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';

/**
 * Dedupe of redelivered events via `SET NX` on `event:<messageId>`.
 * First consumer wins; redeliveries are skipped for 24h.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private prefix = 'event:';
  private ttl = 60 * 60 * 24;

  constructor(private readonly cache: RedisService) {}

  async alreadyProcessed(messageId?: string): Promise<boolean> {
    if (!messageId) {
      this.logger.warn('Event without messageId — cannot dedupe, processing');
      return false;
    }

    const created = await this.cache.setNx(
      `${this.prefix}${messageId}`,
      '1',
      this.ttl,
    );

    return !created;
  }
}
