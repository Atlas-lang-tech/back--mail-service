import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7: connection URLs live here (not in schema.prisma). The same pg
// adapter the runtime uses drives Migrate.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  adapter: () =>
    new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
