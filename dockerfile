# ---------- build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY . .

RUN pnpm prisma generate
RUN pnpm build

# NB: we intentionally do NOT `pnpm prune --prod` here. `prisma migrate deploy`
# at startup loads prisma.config.ts, which imports `prisma/config` and `dotenv`
# — both must remain resolvable in node_modules at runtime.

# ---------- runtime stage ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma ./prisma
# Prisma 7 keeps the datasource URL in this config file (not in schema.prisma),
# so `prisma migrate deploy` at startup needs it present at runtime.
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package.json ./package.json
# vue-email `.vue` templates are compiled from disk at runtime (not bundled into
# dist), so ship them next to the source path render.ts resolves by default.
COPY --from=build /app/src/mail/templates ./src/mail/templates

EXPOSE 3000

# Apply migrations at startup, then run the compiled server.
CMD ["sh", "-c", "npx prisma migrate deploy && pnpm start:prod"]
