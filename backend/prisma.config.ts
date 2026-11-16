import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// The CLI (migrate, db seed, studio) uses the classic Prisma engine and the DIRECT connection when set
// (Supabase pooler cannot run migrations). The runtime app uses Prisma Client without the Rust engine
// plus @prisma/adapter-pg on the pooled DATABASE_URL (see src/prisma/prisma.service.ts and schema.prisma).
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL (or DIRECT_URL) is not set');

export default defineConfig({
  engine: 'classic',
  datasource: { url },
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
});
