import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7: connection URL for migrate/introspection lives here, not in the
// schema. `prisma migrate deploy` requires `datasource.url` explicitly. The
// runtime client gets its connection via the PrismaPg adapter in PrismaService.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
