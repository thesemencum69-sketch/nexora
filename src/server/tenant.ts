import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { memberships } from "@/db/schema";
import { can, type Permission } from "@/lib/permissions";
import type { Role } from "@/types/crm";
import { getSession } from "./session";

/**
 * Контекст запроса: кто действует и в какой компании.
 * Компания всегда берётся из сессии, а не из данных формы, — подменить
 * workspaceId в запросе и попасть в чужие данные нельзя.
 */
export interface TenantContext {
  userId: string;
  memberId: string;
  workspaceId: string;
  role: Role;
}

export class AccessError extends Error {
  constructor(
    readonly code: "unauthenticated" | "forbidden",
    message: string,
  ) {
    super(message);
  }
}

export async function requireTenant(permission?: Permission): Promise<TenantContext> {
  const session = await getSession();
  if (!session) throw new AccessError("unauthenticated", "Войдите в аккаунт, чтобы продолжить");
  if (!session.activeWorkspaceId) throw new AccessError("forbidden", "Выберите компанию");

  const [member] = await getDb()
    .select({ id: memberships.id, role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, session.userId), eq(memberships.workspaceId, session.activeWorkspaceId)))
    .limit(1);

  if (!member) throw new AccessError("forbidden", "У вас нет доступа к этой компании");
  if (permission && !can(member.role, permission)) throw new AccessError("forbidden", "Недостаточно прав для этого действия");

  return { userId: session.userId, memberId: member.id, workspaceId: session.activeWorkspaceId, role: member.role };
}

/** Сотрудник без права deals.view_all видит и меняет только свои сделки */
export const seesOnlyOwn = (ctx: TenantContext) => !can(ctx.role, "deals.view_all");

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Partial<Record<string, string>> };

/** Превращает исключение в ответ для формы, не раскрывая внутренних деталей */
export function toActionError(error: unknown): { ok: false; error: string } {
  if (error instanceof AccessError) return { ok: false, error: error.message };
  console.error("[server action]", error);
  return { ok: false, error: "Не получилось сохранить. Попробуйте ещё раз через минуту." };
}
