# Конвенції сервісу (шаблон для нового мікросервісу)

Цей файл описує всі архітектурні та кодові конвенції цього NestJS-сервісу, щоб
можна було підняти схожий сервіс з нуля з тим самим стилем. Орієнтуйся на нього
як на чеклист.

---

## 1. Стек і інструменти

- **NestJS 11** + **TypeScript 5.7**, `module: ES2022`, target `ES2023`.
- **PostgreSQL** через **Prisma 7** з driver adapter `@prisma/adapter-pg`.
- **Redis** через **ioredis** (кешування).
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
    interceptors/transform.interceptor.ts
    filters/http-exception.filter.ts
    testing/mocks.ts            # моки Prisma/Redis для юніт-тестів
  modules/
    Prisma/prisma.{service,module}.ts
    redis/redis.{service,module}.ts
  <feature>/                    # один домен = один модуль
    <feature>.module.ts
    <feature>.service.ts
    <feature>.service.spec.ts
    <feature>.private.controller.ts   # CRUD під private/<feature>
    <feature>.public.controller.ts    # read-only під public/<feature>
    dto/*.dto.ts
```

---

## 5. Feature-модуль (патерн)

Кожен домен — самодостатній NestJS-модуль:

```ts
@Module({
  imports: [PrismaModule],        // RedisModule НЕ імпортуємо — він @Global
  controllers: [XxxPrivateController, XxxPublicController],
  providers: [XxxService],
})
export class XxxModule {}
```

- `PrismaModule` імпортуй у кожен feature-модуль, що ходить у БД.
- `RedisModule` — `@Global`, тож `RedisService` інжектиться будь-де без імпорту.
- Зареєструй новий модуль в `app.module.ts → imports`.

### Public vs private контролери

- `*.private.controller.ts` → роут `@Controller('private/<feature>')` — CRUD.
- `*.public.controller.ts` → роут `@Controller('public/<feature>')` — лише читання.
- **Auth-гарда поки немає** — це лише угода про роутинг, не безпека.

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
if (exists)  throw new ConflictException('Course already exists');
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

---

## 9. DTO

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

## 10. Сервіси + кешування (Redis)

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

Тонка обгортка над ioredis: `get / set(key,val,ttl?) / del / exists / expire /
keys`. `set` з ttl → `SET key val EX ttl`. `@Global` модуль,
`onModuleDestroy` → `disconnect()`.

---

## 11. Конфігурація / env

`ConfigModule.forRoot({ isGlobal: true, validate })` в `app.module.ts`.
`validate` (`common/env.validation.ts`) валідує env на старті через
`class-validator` і кидає, якщо щось відсутнє/невалідне:

- `DATABASE_URL` (string, required)
- `REDIS_HOST` (string, required)
- `REDIS_PORT` (number 1–65535, required)
- `REDIS_DB` (number ≥0, required)
- `REDIS_PASSWORD` (string, optional)

Нову required-змінну додавай у клас `EnvironmentVariables`.

---

## 12. Тести (Jest, ESM)

- Файли `*.spec.ts` поруч із кодом під `src/`.
- Сервіси інстансуються **напряму з моками**, без `Test.createTestingModule`:
  ```ts
  const service = new CourseService(createMockPrisma() as any, createMockRedis() as any);
  ```
- Моки в `src/common/testing/mocks.ts`: `createMockPrisma()` (кожна модель —
  `findUnique/findFirst/findMany/create/update/delete/deleteMany` як `jest.fn`,
  плюс `$transaction`, що виконує callback inline), `createMockRedis()`
  (за замовчуванням cache-miss: `get → null`).
- `testing/**` і `dto/**` виключені з coverage та з production-build.
- Запуск одного файла: `pnpm jest path/to/file.spec.ts`.

---

## 13. Команди

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
docker compose up -d           # локальні Postgres + Redis
```

---

## 14. Деплой

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
4. `<feature>.private.controller.ts` (`private/<feature>`, `ParseIntPipe`) і за
   потреби `<feature>.public.controller.ts`.
5. `<feature>.module.ts` — `imports: [PrismaModule]`, контролери, сервіс.
6. Зареєструй модуль в `app.module.ts`.
7. `<feature>.service.spec.ts` з моками з `common/testing/mocks.ts`.
8. Усі відносні імпорти — з `.js`.
