"use server";

/**
 * Серверные действия для сделок — образец для остальных сущностей.
 * Порядок всегда один: кто и где (requireTenant) → права → валидация zod →
 * запрос с фильтром по workspace_id → запись в историю и ленту в одной транзакции.
 *
 * Демо-режим интерфейса вызывает те же операции в клиентском хранилище
 * (src/lib/store/crm-store.ts); при подключении базы компоненты переключаются
 * на эти функции без изменения разметки.
 */
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { activities, clients, dealStageHistory, deals, memberships } from "@/db/schema";
import { STAGE_REACH } from "@/lib/constants";
import { dealSchema, fieldErrors } from "@/lib/validators";
import { seesOnlyOwn, requireTenant, toActionError, type ActionResult } from "@/server/tenant";

const STAGES = ["new", "contact", "qualification", "proposal", "negotiation", "won", "lost"] as const;
const toKopecks = (rub: number) => Math.round(rub * 100);

export async function createDealAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();
    const parsed = dealSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Проверьте поля формы", fields: fieldErrors(parsed.error) };
    const values = parsed.data;
    // сотрудник с ограниченными правами может назначить сделку только себе
    const ownerId = seesOnlyOwn(ctx) ? ctx.memberId : values.ownerId;
    const db = getDb();

    return await db.transaction(async (tx) => {
      // клиент и ответственный должны принадлежать этой же компании;
      // составные внешние ключи в схеме дублируют эту проверку на уровне базы
      const [client] = await tx
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.id, values.clientId), eq(clients.workspaceId, ctx.workspaceId)))
        .limit(1);
      if (!client) return { ok: false as const, error: "Клиент не найден", fields: { clientId: "Выберите клиента из списка" } };

      const [owner] = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(and(eq(memberships.id, ownerId), eq(memberships.workspaceId, ctx.workspaceId)))
        .limit(1);
      if (!owner) return { ok: false as const, error: "Ответственный не найден", fields: { ownerId: "Выберите сотрудника" } };

      const closed = values.stage === "won" || values.stage === "lost";
      const [deal] = await tx
        .insert(deals)
        .values({
          workspaceId: ctx.workspaceId,
          title: values.title,
          clientId: client.id,
          amount: toKopecks(values.amount),
          stage: values.stage,
          stageReached: STAGE_REACH[values.stage],
          ownerId: owner.id,
          priority: values.priority,
          expectedCloseAt: values.expectedCloseAt.slice(0, 10),
          closedAt: closed ? new Date() : null,
        })
        .returning({ id: deals.id });

      await tx.insert(dealStageHistory).values({ workspaceId: ctx.workspaceId, dealId: deal!.id, fromStage: null, toStage: values.stage, changedById: ctx.memberId });
      await tx.insert(activities).values({
        workspaceId: ctx.workspaceId,
        type: "deal_created",
        actorId: ctx.memberId,
        dealId: deal!.id,
        clientId: client.id,
        meta: { title: values.title, amount: values.amount },
      });
      return { ok: true as const, data: { id: deal!.id } };
    });
  } catch (error) {
    return toActionError(error);
  }
}

const moveSchema = z.object({
  dealId: z.string().uuid(),
  stage: z.enum(STAGES),
  lostReason: z.string().trim().max(200).optional(),
});

export async function moveDealAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireTenant();
    const parsed = moveSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Некорректный этап", fields: fieldErrors(parsed.error) };
    const { dealId, stage, lostReason } = parsed.data;
    const db = getDb();

    return await db.transaction(async (tx) => {
      const [deal] = await tx
        .select()
        .from(deals)
        .where(and(eq(deals.id, dealId), eq(deals.workspaceId, ctx.workspaceId)))
        .for("update")
        .limit(1);
      // чужая сделка и несуществующая выглядят одинаково — не подсказываем, что id существует
      if (!deal || (seesOnlyOwn(ctx) && deal.ownerId !== ctx.memberId)) return { ok: false as const, error: "Сделка не найдена" };
      if (deal.stage === stage) return { ok: true as const, data: { id: deal.id } };

      const now = new Date();
      const closed = stage === "won" || stage === "lost";
      await tx
        .update(deals)
        .set({
          stage,
          stageReached: stage === "lost" ? deal.stageReached : Math.max(deal.stageReached, STAGE_REACH[stage]),
          closedAt: closed ? now : null,
          lostReason: stage === "lost" ? (lostReason ?? null) : null,
          lastActivityAt: now,
        })
        .where(and(eq(deals.id, deal.id), eq(deals.workspaceId, ctx.workspaceId)));

      await tx.insert(dealStageHistory).values({ workspaceId: ctx.workspaceId, dealId: deal.id, fromStage: deal.stage, toStage: stage, changedById: ctx.memberId });
      await tx.insert(activities).values({
        workspaceId: ctx.workspaceId,
        type: stage === "won" ? "deal_won" : stage === "lost" ? "deal_lost" : "deal_stage_changed",
        actorId: ctx.memberId,
        dealId: deal.id,
        clientId: deal.clientId,
        meta: { from: deal.stage, to: stage, title: deal.title, amount: deal.amount / 100 },
      });
      return { ok: true as const, data: { id: deal.id } };
    });
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteDealAction(dealId: unknown): Promise<ActionResult<null>> {
  try {
    const ctx = await requireTenant("deals.delete");
    const id = z.string().uuid().safeParse(dealId);
    if (!id.success) return { ok: false, error: "Сделка не найдена" };
    const removed = await getDb()
      .delete(deals)
      .where(and(eq(deals.id, id.data), eq(deals.workspaceId, ctx.workspaceId)))
      .returning({ id: deals.id });
    return removed.length ? { ok: true, data: null } : { ok: false, error: "Сделка не найдена" };
  } catch (error) {
    return toActionError(error);
  }
}
