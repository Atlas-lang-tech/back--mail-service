import 'reflect-metadata';
import { validate } from './env.validation.js';

const validEnv = {
  DATABASE_URL: 'postgresql://localhost:5432/mail',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  REDIS_DB: '0',
  RABBITMQ_URL: 'amqp://localhost:5672',
  RESEND_API_KEY: 're_test',
  MAIL_FROM: 'no-reply@example.com',
  APP_BASE_URL: 'https://app.example.com',
};

describe('env.validation', () => {
  it('accepts a valid environment and coerces numeric strings', () => {
    const result = validate({ ...validEnv });

    expect(result.REDIS_PORT).toBe(6379);
    expect(result.REDIS_DB).toBe(0);
    expect(result.MAIL_FROM).toBe('no-reply@example.com');
  });

  it('throws when a required variable is missing', () => {
    const withoutKey: Record<string, unknown> = { ...validEnv };
    delete withoutKey.RESEND_API_KEY;
    expect(() => validate(withoutKey)).toThrow();
  });

  it('throws when REDIS_PORT is out of range', () => {
    expect(() => validate({ ...validEnv, REDIS_PORT: '70000' })).toThrow();
  });

  it('throws when MAIL_PROVIDER is not an allowed value', () => {
    expect(() => validate({ ...validEnv, MAIL_PROVIDER: 'mailgun' })).toThrow();
  });
});
