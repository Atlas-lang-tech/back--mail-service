import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UserRegisteredDto } from './user-registered.dto.js';
import { PasswordResetRequestedDto } from './password-reset-requested.dto.js';
import { PaymentSucceededDto } from './payment-succeeded.dto.js';

function errorsFor<T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
) {
  return validateSync(plainToInstance(cls, payload));
}

describe('event DTO validation', () => {
  describe('UserRegisteredDto', () => {
    const base = {
      eventId: randomUUID(),
      userId: 'u-1',
      email: 'user@example.com',
      verificationToken: 'verify-tok',
    };

    it('passes for a valid payload (name optional)', () => {
      expect(errorsFor(UserRegisteredDto, base)).toHaveLength(0);
      expect(
        errorsFor(UserRegisteredDto, { ...base, name: 'Andrey' }),
      ).toHaveLength(0);
    });

    it('fails when eventId is not a UUID', () => {
      expect(
        errorsFor(UserRegisteredDto, { ...base, eventId: 'not-a-uuid' }).length,
      ).toBeGreaterThan(0);
    });

    it('fails when email is malformed', () => {
      expect(
        errorsFor(UserRegisteredDto, { ...base, email: 'nope' }).length,
      ).toBeGreaterThan(0);
    });
  });

  describe('PasswordResetRequestedDto', () => {
    const base = {
      eventId: randomUUID(),
      userId: 'u-1',
      email: 'user@example.com',
      resetToken: 'reset-tok',
    };

    it('passes for a valid payload', () => {
      expect(errorsFor(PasswordResetRequestedDto, base)).toHaveLength(0);
    });

    it('fails when resetToken is missing', () => {
      const rest: Record<string, unknown> = { ...base };
      delete rest.resetToken;
      expect(errorsFor(PasswordResetRequestedDto, rest).length).toBeGreaterThan(
        0,
      );
    });
  });

  describe('PaymentSucceededDto', () => {
    const base = {
      eventId: randomUUID(),
      userId: 'u-1',
      email: 'buyer@example.com',
      amount: 19.99,
      currency: 'USD',
      invoiceNumber: 'INV-2026-001',
      paidAt: '2026-06-24T10:00:00.000Z',
    };

    it('passes for a valid payload', () => {
      expect(errorsFor(PaymentSucceededDto, base)).toHaveLength(0);
    });

    it('fails when amount is not a number', () => {
      expect(
        errorsFor(PaymentSucceededDto, { ...base, amount: 'free' }).length,
      ).toBeGreaterThan(0);
    });
  });
});
