# Конвенції сервісу (шаблон для нового мікросервісу)

Цей файл описує всі архітектурні та кодові конвенції цього NestJS-сервісу, щоб
можна було підняти схожий сервіс з нуля з тим самим стилем. Орієнтуйся на нього
як на чеклист.

---

## 1. Стек і інструменти

- **NestJS 11** + **TypeScript 5.7**, `module: ES2022`, target `ES2023`.
- **PostgreSQL** через **Prisma 7** з driver adapter `@prisma/adapter-pg`.
- **Redis** через **ioredis** (кешування + dedupe подій).
- **RabbitMQ** через **`@golevelup/nestjs-rabbitmq`** (інтеграція подій між сервісами).
- **Auth** — контекст користувача з хедерів від Traefik ForwardAuth (без локальної логіки логіну).
- **Swagger** (`@nestjs/swagger`) — UI на `/docs`.
- **Jest 30** (ESM-режим) для юніт-тестів.
- Менеджер пакетів — **pnpm**. Деплой — Docker (multi-stage) + CI на гілку `prod`.

---

## 2. ESM-проєкт (критично)

`package.json` має `"type": "module"`. Тому:

- **Усі відносні імпорти ОБОВ'ЯЗКОВО з розширенням `.js`**, навіть якщо файл — `.ts`:
  ```ts
  import { CourseService } from './course.service.js';
  import { PrismaService } from '../modules/Prisma/prisma.service.js';
  ```
  Без `.js` — ламається і build, і runtime.
- `tsconfig`: `moduleResolution: node`, `isolatedModules: true`,
  `emitDecoratorMetadata: true`, `experimentalDecorators: true`,
  `strictNullChecks: true`, `noImplicitAny: false`.
- Jest працює в ESM (`extensionsToTreatAsEsm`, `--experimental-vm-modules`),
  тож у тестах теж `.js` в імпортах; `moduleNameMapper` мапить `.js` → `.ts`.

---

## 3. Prisma (кастомний клієнт)

- Клієнт генерується **НЕ в `@prisma/client`**, а в `generated/prisma` (gitignored):
  ```prisma
  generator client {
    provider = "prisma-client"
    output   = "../generated/prisma"
  }
  ```
- Імпортуй `PrismaClient` з `../../../generated/prisma/client.js`, а не з пакета.
- `PrismaService` (`src/modules/Prisma/`) `extends PrismaClient`, реалізує
  `OnModuleInit` / `OnModuleDestroy` (`$connect` / `$disconnect`), і будує
  адаптер `PrismaPg` з `process.env.DATABASE_URL` **до** `super()`:
  ```ts
  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    super({ adapter });
  }
  ```
- **Завжди** `pnpm prisma generate` після pull/зміни схеми.
- **Іменування моделей:** моделі camelCase однина (`blokInfo`, `languageLvl`),
  `@@map` на snake_case множину SQL-таблиць (`@@map("language_lvls")`).
  Існуючі друкарські помилки в назвах (`blok`, `Choise`) — **зберігай як є**,
  не "виправляй", інакше розійдешся зі схемою.

---

## 4. Структура проєкту

```
src/
  main.ts                       # bootstrap + Swagger
  app.module.ts                 # кореневий модуль: ConfigModule + усі feature-модулі
  common/
    setup-app.ts                # глобальна конфігурація app (prefix, pipes, filters, CORS)
    env.validation.ts           # валідація env через class-validator
    auth/                       # контекст користувача з хедерів + ролі
      user-context.guard.ts     # читає X-User-* → request.user
      current-user.decorator.ts # @CurrentUser() → UserContext
      roles.guard.ts            # енфорсить @Roles(...)
      roles.decorator.ts        # @Roles([...]) через Reflector
      roles.ts                  # Role enum (USER/ADMIN/MODERATOR)
    interceptors/transform.interceptor.ts
    filters/http-exception.filter.ts
    testing/mocks.ts            # моки Prisma/Redis для юніт-тестів
  modules/
    Prisma/prisma.{service,module}.ts
    redis/redis.{service,module}.ts
    messaging/                  # RabbitMQ: publisher + consumers + dedupe
      messaging.module.ts       # @Global, RabbitMQModule.forRootAsync
      messaging.constants.ts    # exchange/DLX/routing keys + типи подій
      event-publisher.service.ts
      idempotency.service.ts    # dedupe по messageId (Redis SET NX)
  <feature>/                    # один домен = один модуль
    <feature>.module.ts
    <feature>.service.ts        # CRUD + cache + @RabbitSubscribe-консюмери
    <feature>.service.spec.ts
    <feature>.admin.controller.ts     # CRUD під private/admin/<feature>, @Roles([ADMIN])
    <feature>.private.controller.ts   # під private/me/<feature>, контекст користувача
    <feature>.public.controller.ts    # read-only під public/<feature>
    dto/*.dto.ts
```

---

## 5. Feature-модуль (патерн)

Кожен домен — самодостатній NestJS-модуль:

```ts
@Module({
  imports: [PrismaModule], // RedisModule НЕ імпортуємо — він @Global
  controllers: [XxxPrivateController, XxxPublicController],
  providers: [XxxService],
})
export class XxxModule {}
```

- `PrismaModule` імпортуй у кожен feature-модуль, що ходить у БД.
- `RedisModule` — `@Global`, тож `RedisService` інжектиться будь-де без імпорту.
- Зареєструй новий модуль в `app.module.ts → imports`.

### Public / private / admin контролери

- `*.public.controller.ts` → `@Controller('public/<feature>')` — read-only, **без гарди**.
- `*.private.controller.ts` → `@Controller('private/me/<feature>')` — дії від імені
  поточного користувача; `@UseGuards(UserContextGuard)` + `@CurrentUser()`.
- `*.admin.controller.ts` → `@Controller('private/admin/<feature>')` — CRUD;
  `@UseGuards(UserContextGuard, RolesGuard)` + `@Roles([Role.ADMIN])` на класі.

Префікс `public/` vs `private/` — для маршрутизації на gateway (private проходить
через ForwardAuth). Безпеку забезпечують гарди (див. секцію 9), не сам префікс.

---

## 6. Глобальна конфігурація app (`common/setup-app.ts`)

Винесено в окрему функцію, щоб `bootstrap()` і e2e-тести вмикали **однакову**
конфігурацію. Новий сервіс повторює це:

```ts
export function setupApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api/<service>');     // напр. 'api/course'
  app.enableShutdownHooks();
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  app.enableCors({ origin: [...], methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', credentials: true });
  return app;
}
```

`main.ts` лише: `NestFactory.create` → `setupApp(app)` → Swagger (`/docs`) →
`app.listen(process.env.PORT ?? 3000)`.

---

## 7. Response-конверт і обробка помилок

### TransformInterceptor (глобальний)

Обгортає **кожну** відповідь контролера у:

```json
{ "code": <httpStatus>, "message": "Success", "data": <return value> }
```

Контролери повертають **сирі сутності** — конверт не будуй вручну. Якщо значення
вже у форматі `{code,message,data}`, інтерсептор не обгортає повторно.

### HttpExceptionFilter (глобальний, `@Catch()`)

Ловить усе і віддає той самий `{ code, message, data: {} }`. Спецкейси Prisma:

- `P2002` → **409 Conflict** (unique constraint),
- `P2025` → **404 Not Found**,
- інші Prisma-коди → **400 Bad Request**,
- `HttpException` → свій статус/повідомлення,
- решта `Error` → 500 з `error.message`.

### Як кидати помилки в сервісах

Використовуй **Nest-винятки** (`NotFoundException`, `ConflictException`,
`BadRequestException`) — фільтр сам відформатує:

```ts
if (!course) throw new NotFoundException('Course not found');
if (exists) throw new ConflictException('Course already exists');
```

---

## 8. Контролери

- Маршрут на класі: `@Controller('private/<feature>')`.
- Парсинг id — через `ParseIntPipe`, не вручну:
  ```ts
  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) { ... }
  ```
- DTO в `@Body()` валідуються глобальним `ValidationPipe` (`whitelist + transform`)
  через декоратори `class-validator` на DTO.
- Контролер тонкий: делегує сервісу і повертає результат. Для delete —
  `return { message: 'Xxx deleted successfully' }`.
- Якщо домен ключується бізнес-кодом (рядок), а не числовим id — параметр беремо
  як `@Param('code') code: string` (без `ParseIntPipe`), напр. `plan`.
- Гарди вішаємо на класі через `@UseGuards(...)`; `@Roles([...])` — на класі або
  на конкретному хендлері. Порядок гард важливий: `UserContextGuard` **перед**
  `RolesGuard` (другий читає `request.user.role`, який ставить перший).

---

## 9. Auth / контекст користувача (з хедерів)

Сервіс **не логінить** користувача сам. За автентифікацію відповідає gateway
(Traefik ForwardAuth), який після перевірки токена прокидає хедери
`X-User-Id`, `X-User-Role`, `X-User-Plan`. Усе в `src/common/auth/`.

### UserContextGuard

Читає хедери і кладе `request.user: UserContext` (`{ id, role, plan }`):

```ts
const id = request.header('x-user-id');
if (!id) throw new UnauthorizedException('Missing user context');
request.user = {
  id,
  role: request.header('x-user-role') ?? 'USER', // дефолти
  plan: request.header('x-user-plan') ?? 'FREE',
};
```

- Відсутній `X-User-Id` → **401**: значить запит обійшов gateway.
- `role`/`plan` мають дефолти (`USER` / `FREE`) — gateway гарантує id, не решту.
- Вішається на **private**-роути: `@UseGuards(UserContextGuard)`.

### @CurrentUser()

Param-декоратор, що дістає `request.user`. Лише на роутах під `UserContextGuard`:

```ts
@Get()
getMine(@CurrentUser() user: UserContext) {
  return this.service.getForUser(user.id);
}
```

### Ролі: @Roles + RolesGuard

- `Role` (`auth/roles.ts`) — `as const`-обʼєкт `USER/ADMIN/MODERATOR`, дзеркалить
  enum auth-сервісу. **Не** TS-`enum` (ESM-дружній патерн).
- `@Roles([Role.ADMIN])` (`Reflector.createDecorator<string[]>()`) на класі/хендлері.
- `RolesGuard` читає метадані; **порожні/відсутні** → пускає будь-якого
  автентифікованого; інакше перевіряє `request.user.role` → **403** при невідповідності.
- Завжди в парі: `@UseGuards(UserContextGuard, RolesGuard)`.

---

## 10. DTO

`dto/*.dto.ts`, валідація через `class-validator`:

```ts
export class CreateCourseDto {
  @IsString() cid: string;
  @IsString() title: string;
  @IsOptional() @IsNumber() categoryId?: number;
}
```

Опціональні поля — `@IsOptional()` + тип `?`.

---

## 11. Сервіси + кешування (Redis)

Еталон — `course.service.ts`. Конвенції:

- Інжекти: `private db: PrismaService`, `private cache: RedisService`.
- Префікс ключів на сервіс: `private cacheKey = 'course:'`.
- Формати ключів: `course:all`, `course:<id>`, `course:<cid>`,
  `course:language-<id>`, `course:category-<id>`. **TTL = 3600s**.

**Читання (cache-aside):**

```ts
const cached = await this.cache.get(key);
if (cached) return JSON.parse(cached);
const data = await this.db.course.findMany();
await this.cache.set(key, JSON.stringify(data), 3600);
return data;
```

**Мутації (create/update/delete):** після запису в БД **інвалідуй** усі залежні
ключі (включно з `:all`) через приватний `invalidate(...)`. На `update`
інвалідуй і стару, і нову сутність (relation-бакети могли змінитись):

```ts
await this.invalidate(oldCourse);
await this.invalidate(updatedCourse);
```

### RedisService (`src/modules/redis/`)

Тонка обгортка над ioredis: `get / set(key,val,ttl?) / setNx(key,val,ttl) / del /
exists / expire / keys`. `set` з ttl → `SET key val EX ttl`; `setNx` →
`SET key val EX ttl NX` (повертає `true`, якщо ключ створено) — використовується
для dedupe подій. `@Global` модуль, `onModuleDestroy` → `disconnect()`.

---

## 12. Messaging / події (RabbitMQ)

Сервіси спілкуються асинхронно через топік-exchange `atlas.events`. Усе в
`src/modules/messaging/`, модуль `@Global` (`RabbitMQModule.forRootAsync`,
`uri` з `RABBITMQ_URL` через `config.getOrThrow`). Експортує `EventPublisher`,
`IdempotencyService` і сам `RabbitMQModule`.

### Контракт (`messaging.constants.ts`)

- `EVENTS_EXCHANGE = 'atlas.events'`, `EVENTS_DLX = 'atlas.events.dlx'` (топік).
- `RoutingKey` — `as const`-обʼєкт усіх ключів екосистеми (`subscription.changed`,
  `plan.upserted`, `course.purchased`, `course.upserted`, …).
- Окремі `interface`-и на **кожну** подію (і ті, що публікуємо, і ті, що споживаємо).
  Це **спільний контракт екосистеми** — змінюй узгоджено з іншими сервісами.

### Публікація (`EventPublisher`)

Інжектить `AmqpConnection`. Один приватний `publish(routingKey, payload)` з
`{ persistent: true, messageId: randomUUID(), contentType: 'application/json' }`,
плюс тонкий типізований метод на подію:

```ts
subscriptionChanged(event: SubscriptionChangedEvent) {
  return this.publish(RoutingKey.SubscriptionChanged, event);
}
```

Кожне повідомлення **persistent** і має унікальний `messageId` для дедупу.
Сервіс інжектить `EventPublisher` і кличе після успішного запису в БД.

### Споживання (`@RabbitSubscribe` в сервісі)

Консюмери — це методи feature-сервісу (не окремі контролери):

```ts
@RabbitSubscribe({
  exchange: EVENTS_EXCHANGE,
  routingKey: RoutingKey.CourseUpserted,
  queue: 'billing.product.course-upserted',           // '<service>.<feature>.<event>'
  queueOptions: { durable: true, deadLetterExchange: EVENTS_DLX },
})
async onCourseUpserted(event: CourseUpsertedEvent, amqpMsg: ConsumeMessage) {
  if (await this.idempotency.alreadyProcessed(amqpMsg.properties.messageId)) return;
  // ... обробка, потім invalidate кешу
}
```

- Черга **durable** + `deadLetterExchange: EVENTS_DLX`.
- **Перший рядок** хендлера — guard на ідемпотентність (див. нижче).
- Після мутації — інвалідуй кеш як у звичайних мутаціях.
- `MessagingModule` `@Global`, тож `EventPublisher`/`IdempotencyService` доступні
  без імпорту; `enableControllerDiscovery: true` піднімає консюмери в провайдерах.

### Ідемпотентність (`IdempotencyService`)

`alreadyProcessed(messageId?)` робить Redis `SET NX` на `event:<messageId>` з TTL
24 год: перший консюмер виграє, повторні доставки — скіп. Відсутній `messageId`
трактується як «не бачили» (не можемо дедупнути) + warning у лог.

---

## 13. Конфігурація / env

`ConfigModule.forRoot({ isGlobal: true, validate })` в `app.module.ts`.
`validate` (`common/env.validation.ts`) валідує env на старті через
`class-validator` і кидає, якщо щось відсутнє/невалідне:

- `DATABASE_URL` (string, required)
- `REDIS_HOST` (string, required)
- `REDIS_PORT` (number 1–65535, required)
- `REDIS_DB` (number ≥0, required)
- `REDIS_PASSWORD` (string, optional)
- `RABBITMQ_URL` (string, required) — `amqp://...`

`PORT` валідатором не покривається (читається напряму як `process.env.PORT ?? 3000`).
Нову required-змінну додавай у клас `EnvironmentVariables` (`@IsString()`/`@IsNumber()`

- `@Min/@Max` де треба; опціональні — `@IsOptional()`), синхронь `.env.example`,
  а в коді читай через `ConfigService.getOrThrow<T>(...)` (не `process.env` напряму).
  `skipMissingProperties: false` — будь-яка відсутня required-змінна валить старт.

---

## 14. Тести (Jest, ESM)

- Файли `*.spec.ts` поруч із кодом під `src/`.
- Сервіси інстансуються **напряму з моками**, без `Test.createTestingModule`:
  ```ts
  const service = new CourseService(
    createMockPrisma() as any,
    createMockRedis() as any,
  );
  ```
- Моки в `src/common/testing/mocks.ts`: `createMockPrisma()` (кожна модель —
  `findUnique/findFirst/findMany/create/update/delete/deleteMany` як `jest.fn`,
  плюс `$transaction`, що виконує callback inline), `createMockRedis()`
  (за замовчуванням cache-miss: `get → null`, `setNx → true`).
- Гарди/декоратори тестуються напряму з фейковим `ExecutionContext` (див.
  `auth/user-context.guard.spec.ts`) — без піднімання Nest-додатка.
- Консюмери подій — звичайні методи сервісу: викликай їх напряму, передаючи
  подію і фейковий `amqpMsg` з `properties.messageId`; `EventPublisher`/
  `IdempotencyService` мокаються як прості обʼєкти з `jest.fn`.
- `testing/**` і `dto/**` виключені з coverage та з production-build.
- Запуск одного файла: `pnpm jest path/to/file.spec.ts`.

---

## 15. Команди

```bash
pnpm install
pnpm start:dev                 # watch-режим
pnpm build                     # nest build → dist/
pnpm start:prod                # node dist/src/main
pnpm lint                      # eslint --fix
pnpm format                    # prettier --write
pnpm test                      # jest юніт-тести
pnpm prisma generate           # ОБОВ'ЯЗКОВО після зміни схеми
pnpm prisma migrate dev --name <name>
docker compose up -d           # локальні Postgres + Redis + RabbitMQ
```

---

## 16. Деплой

- Multi-stage `dockerfile`: pnpm install → `prisma generate` + `pnpm build`.
- Production-старт контейнера: `npx prisma migrate deploy && pnpm start:prod`
  (міграції застосовуються при старті).
- CI (`.github/workflows/`) збирає й пушить multi-arch образ у GHCR на пуш у
  `prod` та на теги `v*`. Робоча гілка — `prod`.

---

## Чеклист: новий feature-модуль

1. Додай модель у `prisma/schema.prisma` (camelCase + `@@map`), `pnpm prisma generate`,
   `pnpm prisma migrate dev --name add_<feature>`.
2. `src/<feature>/dto/create.dto.ts` з `class-validator`.
3. `src/<feature>/<feature>.service.ts` — inject `PrismaService` + `RedisService`,
   `cacheKey`, cache-aside читання, `invalidate(...)` на мутаціях, Nest-винятки.
   За потреби: inject `EventPublisher` (публікуй подію після запису),
   `@RabbitSubscribe`-консюмери з guard на `idempotency.alreadyProcessed(...)`.
4. Контролери за рівнем доступу:
   - `<feature>.public.controller.ts` (`public/<feature>`, без гарди) — читання;
   - `<feature>.private.controller.ts` (`private/me/<feature>`, `@UseGuards(UserContextGuard)`,
     `@CurrentUser()`) — дії користувача;
   - `<feature>.admin.controller.ts` (`private/admin/<feature>`,
     `@UseGuards(UserContextGuard, RolesGuard)`, `@Roles([Role.ADMIN])`) — CRUD.
   - id-параметр: `ParseIntPipe` для числових, `@Param('code')` для рядкових кодів.
5. `<feature>.module.ts` — `imports: [PrismaModule]` (Redis/Messaging `@Global`),
   контролери, сервіс.
6. Зареєструй модуль в `app.module.ts`.
7. Нову event-подію — додай у `messaging.constants.ts` (routing key + `interface`),
   нову env-змінну — у `EnvironmentVariables` + `.env.example`.
8. `<feature>.service.spec.ts` з моками з `common/testing/mocks.ts` (включно з
   консюмерами і гардами, якщо є).
9. Усі відносні імпорти — з `.js`.
