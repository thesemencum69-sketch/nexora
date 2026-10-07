import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";

/**
 * Сессии на своей таблице: в httpOnly-cookie лежит случайный токен,
 * в базе — только его SHA-256. Утечка базы не даёт войти под пользователем,
 * а выход на всех устройствах — это удаление строк.
 */
export const SESSION_COOKIE = "nx_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string, workspaceId: string | null, meta: { ip?: string; userAgent?: string } = {}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getDb()
    .insert(sessions)
    .values({ userId, activeWorkspaceId: workspaceId, tokenHash: hashToken(token), expiresAt, ip: meta.ip, userAgent: meta.userAgent });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export interface SessionUser {
  sessionId: string;
  userId: string;
  name: string;
  email: string;
  activeWorkspaceId: string | null;
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await getDb()
    .select({
      sessionId: sessions.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      activeWorkspaceId: sessions.activeWorkspaceId,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}
