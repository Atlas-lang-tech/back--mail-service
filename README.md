# mail-service

Atlas mail microservice. NestJS 11 (ESM) + Prisma 7 (PostgreSQL) + Redis + RabbitMQ.
Built per [CONVENTIONS.md](./CONVENTIONS.md).

## Quick start

```bash
pnpm install
cp .env.example .env          # fill in DATABASE_URL / REDIS_* / RABBITMQ_URL
docker compose up -d          # local Postgres + Redis + RabbitMQ
pnpm prisma generate          # generates client into generated/prisma
pnpm prisma migrate dev --name init
pnpm start:dev                # watch mode
```

- API base prefix: `api/mail`
- Swagger UI: `http://localhost:3000/docs`
- RabbitMQ UI: `http://localhost:15672` (guest/guest)

## Layout

```
src/
  main.ts                     bootstrap + Swagger
  app.module.ts               ConfigModule + feature modules
  common/
    setup-app, env validation, interceptor, filter, test mocks
    auth/                     header-based user context + @Roles guards
  modules/
    Prisma|redis/             infrastructure services
    messaging/                RabbitMQ publisher + idempotency (@Global)
  template/                   email-template feature (admin CRUD + public read)
  mail/                       mail-log feature (event consumers + per-user reads)
```

## Auth & messaging

- **Auth** — no local login. The gateway (Traefik ForwardAuth) injects `X-User-*`
  headers; `UserContextGuard` exposes them as `request.user`, `RolesGuard` enforces
  `@Roles(...)`. Routes are tiered: `public/` (open), `private/me/` (current user),
  `private/admin/` (`@Roles([Role.ADMIN])`).
- **Messaging** — topic exchange `atlas.events`. `mail/` consumes `course.purchased`
  and `subscription.changed` (deduped via Redis `SET NX`), sends mail, and publishes
  `mail.sent`. Contract lives in `modules/messaging/messaging.constants.ts`.

## Commands

```bash
pnpm start:dev      # watch
pnpm build          # nest build -> dist/
pnpm start:prod     # node dist/src/main
pnpm test           # jest (ESM) unit tests
pnpm lint           # eslint --fix
pnpm format         # prettier --write
pnpm prisma generate
```

## Adding a feature

Follow the checklist at the bottom of [CONVENTIONS.md](./CONVENTIONS.md).
`src/template/` is the reference implementation.
