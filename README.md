# mail-service

Atlas transactional mail microservice. NestJS 11 (ESM) + Prisma 7 (PostgreSQL) +
Redis + RabbitMQ + **BullMQ** + **Resend** + **vue-email**.
Built per [CONVENTIONS.md](./CONVENTIONS.md).

It consumes domain events from RabbitMQ and sends transactional emails through
Resend, rendering templates with vue-email + Tailwind. Delivery is asynchronous
(BullMQ), retried with backoff, idempotent, and the mail provider is abstracted
behind an interface so Resend can later be swapped for SES without touching the
business logic.

## Pipeline

```
RabbitMQ event (eventId UUID)
  → MailEventsConsumer   validate DTO (class-validator)
  → IdempotencyService   Redis SETNX on eventId (skip duplicates)
  → MailQueueProducer    enqueue BullMQ job
        ⇣  worker: retry 5× exponential backoff (2s), rate-limited
  → MailWorkerService → MailService.deliver
  → render .vue (vue-email) → MailProvider.send (Resend)
  → persist mailLog (SENT, providerMessageId) + structured log + publish mail.sent
  ── retries exhausted → 'failed' set (kept, bounded) + dead-letter log
```

Consumed events (each carries a UUID `eventId`):

| Routing key                  | Template                | Email                         |
| ---------------------------- | ----------------------- | ----------------------------- |
| `user.registered`            | `welcome`               | Welcome + email verification  |
| `password.reset_requested`   | `password-reset`        | Password reset link           |
| `billing.payment_succeeded`  | `payment-succeeded`     | Payment receipt               |

## Quick start (local)

```bash
pnpm install
cp .env.example .env           # set RESEND_API_KEY, MAIL_FROM, APP_BASE_URL, ...
docker compose up -d postgres redis rabbitmq   # infra only
pnpm prisma generate
pnpm prisma migrate dev --name init
pnpm start:dev                 # watch mode
```

- HTTP base prefix: `api/mail` · health: `GET http://localhost:3000/api/mail/health`
- Swagger UI: `http://localhost:3000/docs`
- RabbitMQ UI: `http://localhost:15672` (guest/guest)

There are no HTTP controllers for mail — input is exclusively RabbitMQ. The HTTP
surface is only Swagger + the health probe.

## Run everything in Docker

```bash
cp .env.example .env           # RESEND_API_KEY, MAIL_FROM, APP_BASE_URL
docker compose up --build      # service + Postgres + Redis + RabbitMQ
```

The `mail-service` container points `DATABASE_URL` / `REDIS_*` / `RABBITMQ_URL`
at the compose services and applies Prisma migrations on start
(`prisma migrate deploy`).

## Templates (vue-email) + preview

Templates are real `.vue` SFCs in `src/mail/templates/` using
`@vue-email/components` + `@vue-email/tailwind`. Brand tokens (colours, fonts) are
shared via `tailwind.tokens.ts` and injected into every template's
`<ETailwind :config>` by `render.ts`. They are compiled from disk at runtime with
`@vue-email/compiler` (vue/compiler-sfc) — so the `.vue` files ship in the image.

Live preview while editing:

```bash
pnpm email:dev                 # vue-email preview server for the 3 templates
```

## Configuration

Env is validated on boot (`src/common/env.validation.ts`); a missing required
variable aborts startup. See [.env.example](./.env.example).

| Variable                          | Purpose                                  |
| --------------------------------- | ---------------------------------------- |
| `RESEND_API_KEY`                  | Resend API key                           |
| `MAIL_FROM`                       | Default `From` (verified domain)         |
| `MAIL_PROVIDER`                   | Provider selector (`resend`)             |
| `APP_BASE_URL`                    | Front-end base for verify/reset links    |
| `RABBITMQ_URL`                    | `amqp://...`                             |
| `REDIS_HOST/PORT/DB/PASSWORD`     | Redis (cache, idempotency, BullMQ)       |
| `DATABASE_URL`                    | Postgres (mail-log audit)                |
| `MAIL_RATE_MAX` / `_DURATION`     | Worker rate limit (default 2 / 1000ms)   |

> The task's `REDIS_URL` is represented as discrete `REDIS_HOST/PORT/DB/PASSWORD`
> to match the existing `RedisService` / house convention.

## Swapping the mail provider

Implement `MailProvider` (`src/mail/providers/mail-provider.interface.ts`),
register it in `MailModule`, and extend the `MAIL_PROVIDER` factory `switch`.
Consumers and the worker depend only on the `MAIL_PROVIDER` token, so nothing
else changes.

## Reliability

- **Retries** — 5 attempts, exponential backoff from 2s (BullMQ job options).
- **Idempotency** — Redis `SETNX` on `eventId` before enqueue; a second guard on
  the unique `mailLog.eventId` prevents re-sends across in-job retries.
- **Dead-letter** — exhausted jobs stay in the BullMQ `failed` set (bounded) and
  are logged as `mail.dead_letter`. Invalid RabbitMQ payloads are NACKed to the
  `atlas.events.dlx` exchange.
- **Graceful shutdown** — `enableShutdownHooks` + `worker.close()` drains active
  jobs before exit.

## Commands

```bash
pnpm start:dev      # watch
pnpm build          # nest build -> dist/
pnpm start:prod     # node dist/src/main
pnpm test           # jest (ESM): template snapshots, idempotency, flow
pnpm email:dev      # vue-email template preview
pnpm lint           # eslint --fix
pnpm format         # prettier --write
pnpm prisma generate
```

## Tests

- `mail/templates/render.spec.ts` — HTML snapshot per template.
- `mail/mail.service.spec.ts` — `deliver()` with a mocked `MailProvider`.
- `mail/mail-events.consumer.spec.ts` — idempotency + DTO validation + mapping.
- `mail/mail-flow.integration.spec.ts` — event → enqueue → `provider.send`.

## Manual end-to-end (verified Resend domain)

1. `docker compose up --build`.
2. Publish a `user.registered` event to the `atlas.events` topic exchange with a
   fresh `eventId` → an email arrives.
3. Re-publish the same `eventId` → no duplicate email (SETNX guard).
4. Set an invalid `RESEND_API_KEY` and publish → the job retries with backoff and
   lands in the `failed` set with a `mail.dead_letter` log.
