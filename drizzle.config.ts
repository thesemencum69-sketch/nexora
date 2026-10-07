import { defineConfig } from "drizzle-kit";

// адрес базы берём из .env.local (как и Next.js); если файла нет — из окружения
try {
  process.loadEnvFile(".env.local");
} catch {}

/**
 * Миграции базы: npm run db:generate создаёт SQL в папке drizzle/,
 * npm run db:migrate применяет его к базе из DATABASE_URL.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
