import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Подключение к PostgreSQL. Создаётся лениво: демо-режим работает без базы,
 * а при первом обращении к db без DATABASE_URL будет понятная ошибка.
 */
type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { nexoraSql?: postgres.Sql; nexoraDb?: Database };

export function getDb(): Database {
  if (globalForDb.nexoraDb) return globalForDb.nexoraDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не задан. Скопируйте .env.example в .env.local и укажите адрес базы.");
  // prepare: false — совместимо с пулерами соединений (Supabase, Neon, PgBouncer)
  const client = globalForDb.nexoraSql ?? postgres(url, { max: 10, prepare: false });
  const db = drizzle(client, { schema });
  // в dev Next.js перезагружает модули — переиспользуем одно подключение
  if (process.env.NODE_ENV !== "production") {
    globalForDb.nexoraSql = client;
    globalForDb.nexoraDb = db;
  }
  return db;
}

export { schema };
