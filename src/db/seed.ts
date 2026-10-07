/**
 * Заливка демо-данных в PostgreSQL: npm run db:seed
 *
 * Использует тот же генератор, что и демо-режим в браузере, поэтому цифры
 * в базе совпадают с тем, что вы видели в интерфейсе. Повторный запуск
 * пересоздаёт демо-компанию (slug "demo"), другие компании не трогает.
 */
import { eq, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { generateDemoData } from "@/lib/demo/generate";
import { digitsOnly, plural } from "@/lib/utils";
import * as schema from "./schema";

const DEMO_SLUG = "demo";
const CHUNK = 500;

const kopecks = (rub: number) => Math.round(rub * 100);
const toDate = (value: string) => new Date(value);
const maybeDate = (value: string | null | undefined) => (value ? new Date(value) : null);

async function insertChunked<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await insert(rows.slice(i, i + CHUNK));
}

type AnyDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Заливает демо-компанию в переданную базу; возвращает краткую сводку */
export async function seedDemo(db: AnyDatabase, now = Date.now()): Promise<string> {
  const data = generateDemoData({ now });
  const s = schema;

  return db.transaction(async (tx) => {
    // пересоздаём только демо-компанию; каскад удалит все её данные
    await tx.delete(s.workspaces).where(eq(s.workspaces.slug, DEMO_SLUG));

    const [workspace] = await tx
      .insert(s.workspaces)
      .values({
        name: data.workspace.name,
        slug: DEMO_SLUG,
        industry: data.workspace.industry,
        size: data.workspace.size,
        sources: data.workspace.sources,
        plan: data.workspace.plan,
        timezone: data.workspace.timezone,
        requisites: data.workspace.requisites,
        createdAt: toDate(data.workspace.createdAt),
      })
      .returning({ id: s.workspaces.id });
    const workspaceId = workspace!.id;

    /* сотрудники: пользователь + участие в компании */
    await tx
      .insert(s.users)
      .values(data.members.map((m) => ({ email: m.email, name: m.name, phone: m.phone, avatarHue: m.hue })))
      .onConflictDoNothing();
    const users = await tx
      .select({ id: s.users.id, email: s.users.email })
      .from(s.users)
      .where(inArray(s.users.email, data.members.map((m) => m.email)));
    const userByEmail = new Map(users.map((u) => [u.email, u.id]));

    const memberRows = await tx
      .insert(s.memberships)
      .values(
        data.members.map((m) => ({
          workspaceId,
          userId: userByEmail.get(m.email)!,
          role: m.role,
          position: m.position,
          joinedAt: toDate(m.joinedAt),
        })),
      )
      .returning({ id: s.memberships.id, userId: s.memberships.userId });
    const memberIdByUser = new Map(memberRows.map((r) => [r.userId, r.id]));
    const member = new Map(data.members.map((m) => [m.id, memberIdByUser.get(userByEmail.get(m.email)!)!]));
    const memberOrNull = (id: string | null | undefined) => (id ? (member.get(id) ?? null) : null);

    /* этапы воронки под сферу компании, с вероятностями */
    await tx.insert(s.pipelineStages).values(
      data.workspace.pipeline.map((stage, position) => ({ workspaceId, stage: stage.id, label: stage.label, probability: Math.round(stage.probability * 100), position })),
    );

    /* свои поля: значения в карточках ссылаются на новые id полей */
    const fieldId = new Map(data.customFields.map((f) => [f.id, crypto.randomUUID()]));
    if (data.customFields.length)
      await tx.insert(s.customFields).values(
        data.customFields.map((f, position) => ({ id: fieldId.get(f.id)!, workspaceId, entity: f.entity, label: f.label, type: f.type, options: f.options ?? [], position })),
      );
    const custom = (values: Record<string, string> | undefined) =>
      Object.fromEntries(Object.entries(values ?? {}).flatMap(([k, v]) => (fieldId.has(k) && v ? [[fieldId.get(k)!, v]] : [])));

    /* клиенты */
    const clientId = new Map<string, string>();
    const clientRows = data.clients.map((c) => ({ id: crypto.randomUUID(), source: c }));
    clientRows.forEach((r) => clientId.set(r.source.id, r.id));
    await insertChunked(clientRows, (chunk) =>
      tx.insert(s.clients).values(
        chunk.map(({ id, source: c }) => ({
          id,
          workspaceId,
          name: c.name,
          company: c.company,
          email: c.email,
          phone: c.phone,
          phoneDigits: digitsOnly(c.phone),
          city: c.city,
          ownerId: member.get(c.ownerId)!,
          source: c.source,
          tags: c.tags,
          custom: custom(c.custom),
          createdAt: toDate(c.createdAt),
          lastActivityAt: toDate(c.lastActivityAt),
        })),
      ),
    );

    /* лиды (ссылку на сделку проставим после вставки сделок) */
    const leadId = new Map(data.leads.map((l) => [l.id, crypto.randomUUID()]));
    await insertChunked(data.leads, (chunk) =>
      tx.insert(s.leads).values(
        chunk.map((l) => ({
          id: leadId.get(l.id)!,
          workspaceId,
          name: l.name,
          company: l.company,
          email: l.email,
          phone: l.phone,
          phoneDigits: digitsOnly(l.phone),
          source: l.source,
          status: l.status,
          ownerId: memberOrNull(l.ownerId),
          message: l.message,
          budget: l.budget === null ? null : kopecks(l.budget),
          firstResponseAt: maybeDate(l.firstResponseAt),
          convertedAt: maybeDate(l.convertedAt),
          clientId: l.clientId ? (clientId.get(l.clientId) ?? null) : null,
          createdAt: toDate(l.createdAt),
        })),
      ),
    );

    /* сделки и история этапов */
    const dealId = new Map(data.deals.map((d) => [d.id, crypto.randomUUID()]));
    await insertChunked(data.deals, (chunk) =>
      tx.insert(s.deals).values(
        chunk.map((d) => {
          const closed = d.stage === "won" || d.stage === "lost";
          return {
            id: dealId.get(d.id)!,
            workspaceId,
            title: d.title,
            clientId: clientId.get(d.clientId)!,
            amount: kopecks(d.amount),
            stage: d.stage,
            stageReached: d.stageReached,
            ownerId: member.get(d.ownerId)!,
            priority: d.priority,
            source: d.source,
            leadId: d.leadId ? (leadId.get(d.leadId) ?? null) : null,
            lostReason: d.lostReason,
            expectedCloseAt: d.expectedCloseAt.slice(0, 10),
            // ограничение в схеме: закрытая сделка всегда с датой закрытия, открытая — без
            closedAt: closed ? toDate(d.closedAt ?? d.lastActivityAt) : null,
            custom: custom(d.custom),
            createdAt: toDate(d.createdAt),
            updatedAt: toDate(d.updatedAt),
            lastActivityAt: toDate(d.lastActivityAt),
          };
        }),
      ),
    );

    const history = data.deals.flatMap((d) =>
      d.stageHistory.map((change, i) => ({
        workspaceId,
        dealId: dealId.get(d.id)!,
        fromStage: i === 0 ? null : d.stageHistory[i - 1]!.stage,
        toStage: change.stage,
        changedById: member.get(d.ownerId)!,
        changedAt: toDate(change.at),
      })),
    );
    await insertChunked(history, (chunk) => tx.insert(s.dealStageHistory).values(chunk));

    for (const l of data.leads) {
      if (l.dealId && dealId.has(l.dealId)) await tx.update(s.leads).set({ dealId: dealId.get(l.dealId)! }).where(eq(s.leads.id, leadId.get(l.id)!));
    }

    /* задачи, заметки, лента, уведомления */
    const taskId = new Map(data.tasks.map((t) => [t.id, crypto.randomUUID()]));
    await insertChunked(data.tasks, (chunk) =>
      tx.insert(s.tasks).values(
        chunk.map((t) => ({
          id: taskId.get(t.id)!,
          workspaceId,
          title: t.title,
          description: t.description,
          assigneeId: member.get(t.assigneeId)!,
          priority: t.priority,
          status: t.status,
          dueAt: toDate(t.dueAt),
          completedAt: t.status === "done" ? toDate(t.completedAt ?? t.dueAt) : null,
          dealId: t.dealId ? (dealId.get(t.dealId) ?? null) : null,
          clientId: t.clientId ? (clientId.get(t.clientId) ?? null) : null,
          leadId: t.leadId ? (leadId.get(t.leadId) ?? null) : null,
          createdById: memberOrNull(t.createdBy),
          createdAt: toDate(t.createdAt),
        })),
      ),
    );

    await insertChunked(data.notes, (chunk) =>
      tx.insert(s.notes).values(
        chunk.map((n) => ({
          workspaceId,
          body: n.body,
          authorId: member.get(n.authorId)!,
          clientId: n.clientId ? (clientId.get(n.clientId) ?? null) : null,
          dealId: n.dealId ? (dealId.get(n.dealId) ?? null) : null,
          createdAt: toDate(n.createdAt),
        })),
      ),
    );

    await insertChunked(data.activities, (chunk) =>
      tx.insert(s.activities).values(
        chunk.map((a) => ({
          workspaceId,
          type: a.type,
          actorId: memberOrNull(a.actorId),
          clientId: a.clientId ? (clientId.get(a.clientId) ?? null) : null,
          dealId: a.dealId ? (dealId.get(a.dealId) ?? null) : null,
          leadId: a.leadId ? (leadId.get(a.leadId) ?? null) : null,
          taskId: a.taskId ? (taskId.get(a.taskId) ?? null) : null,
          meta: a.meta ?? {},
          createdAt: toDate(a.createdAt),
        })),
      ),
    );

    const owner = member.get(data.currentUserId)!;
    await insertChunked(data.notifications, (chunk) =>
      tx.insert(s.notifications).values(
        chunk.map((n) => ({
          workspaceId,
          recipientId: owner,
          type: n.type,
          title: n.title,
          body: n.body,
          href: null,
          actorId: memberOrNull(n.actorId),
          readAt: n.read ? toDate(n.createdAt) : null,
          createdAt: toDate(n.createdAt),
        })),
      ),
    );

    /* автоматизации: ссылки на сотрудников в параметрах тоже переводим в новые id */
    await tx.insert(s.automations).values(
      data.automations.map((a) => ({
        workspaceId,
        name: a.name,
        description: a.description,
        active: a.active,
        trigger: a.trigger,
        conditions: a.conditions.map((c) => (c.field === "owner" ? { ...c, value: member.get(c.value) ?? c.value } : c)),
        actions: a.actions.map((action) => ({
          ...action,
          params: Object.fromEntries(Object.entries(action.params).map(([k, v]) => [k, member.get(v) ?? v])),
        })),
        runs: a.runs,
        lastRunAt: maybeDate(a.lastRunAt),
        createdById: memberOrNull(a.createdBy),
        createdAt: toDate(a.createdAt),
      })),
    );

    /* товары и позиции сделок */
    const productId = new Map(data.products.map((p) => [p.id, crypto.randomUUID()]));
    if (data.products.length)
      await tx.insert(s.products).values(data.products.map((p) => ({ id: productId.get(p.id)!, workspaceId, name: p.name, price: kopecks(p.price), unit: p.unit })));
    const items = data.deals.flatMap((d) =>
      (d.items ?? []).map((item, position) => ({
        workspaceId,
        dealId: dealId.get(d.id)!,
        productId: item.productId ? (productId.get(item.productId) ?? null) : null,
        name: item.name,
        price: kopecks(item.price),
        qty: item.qty,
        unit: item.unit,
        position,
      })),
    );
    await insertChunked(items, (chunk) => tx.insert(s.dealItems).values(chunk));

    /* счета и КП: позиции и реквизиты — снимком на момент выставления */
    await insertChunked(data.documents, (chunk) =>
      tx.insert(s.documents).values(
        chunk.map((doc) => ({
          workspaceId,
          kind: doc.kind,
          number: doc.number,
          dealId: dealId.get(doc.dealId)!,
          clientId: clientId.get(doc.clientId) ?? null,
          items: doc.items.map((i) => ({ name: i.name, price: kopecks(i.price), qty: i.qty, unit: i.unit })),
          total: kopecks(doc.total),
          requisites: data.workspace.requisites,
          status: doc.status,
          paidAt: doc.status === "paid" ? toDate(doc.paidAt ?? doc.createdAt) : null,
          createdById: memberOrNull(doc.createdBy),
          createdAt: toDate(doc.createdAt),
        })),
      ),
    );

    /* переписка */
    const conversationId = new Map(data.conversations.map((c) => [c.id, crypto.randomUUID()]));
    await insertChunked(data.conversations, (chunk) =>
      tx.insert(s.conversations).values(
        chunk.map((c) => ({
          id: conversationId.get(c.id)!,
          workspaceId,
          channel: c.channel,
          contactName: c.contactName,
          handle: c.handle,
          leadId: c.leadId ? (leadId.get(c.leadId) ?? null) : null,
          clientId: c.clientId ? (clientId.get(c.clientId) ?? null) : null,
          dealId: c.dealId ? (dealId.get(c.dealId) ?? null) : null,
          ownerId: memberOrNull(c.ownerId),
          unread: c.unread,
          lastMessageAt: toDate(c.lastMessageAt),
        })),
      ),
    );
    await insertChunked(data.messages, (chunk) =>
      tx.insert(s.messages).values(
        chunk.map((m) => ({
          workspaceId,
          conversationId: conversationId.get(m.conversationId)!,
          direction: m.direction,
          authorId: memberOrNull(m.authorId),
          text: m.text,
          auto: Boolean(m.auto),
          createdAt: toDate(m.createdAt),
        })),
      ),
    );
    if (data.replyTemplates.length)
      await tx.insert(s.replyTemplates).values(data.replyTemplates.map((t, position) => ({ workspaceId, title: t.title, body: t.body, position })));

    /* планы продаж и сохранённые виды */
    if (data.plans.length)
      await tx.insert(s.salesPlans).values(data.plans.map((p) => ({ workspaceId, memberId: member.get(p.memberId)!, month: `${p.month}-01`, amount: kopecks(p.amount) })));
    if (data.views.length)
      await tx.insert(s.savedViews).values(
        data.views.map((v) => ({
          workspaceId,
          entity: v.entity,
          name: v.name,
          filters: Object.fromEntries(Object.entries(v.filters).map(([k, value]) => [k, k === "owner" ? (member.get(value) ?? value) : value])),
          createdById: owner,
        })),
      );

    await tx.insert(s.subscriptions).values({
      workspaceId,
      plan: "pro",
      status: "trialing",
      billingPeriod: "yearly",
      seats: data.members.length,
      trialEndsAt: new Date(now + 5 * 24 * 60 * 60 * 1000),
    });

    const n = (value: number, forms: [string, string, string]) => `${value} ${plural(value, forms)}`;
    return [
      `«${data.workspace.name}»`,
      n(data.members.length, ["сотрудник", "сотрудника", "сотрудников"]),
      n(data.clients.length, ["клиент", "клиента", "клиентов"]),
      n(data.leads.length, ["лид", "лида", "лидов"]),
      n(data.deals.length, ["сделка", "сделки", "сделок"]),
      n(data.tasks.length, ["задача", "задачи", "задач"]),
      n(data.activities.length, ["событие", "события", "событий"]),
      n(data.conversations.length, ["диалог", "диалога", "диалогов"]),
      n(data.documents.length, ["документ", "документа", "документов"]),
    ].join(", ");
  });
}

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {}
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL не задан. Пример: DATABASE_URL=postgres://user:pass@localhost:5432/nexora npm run db:seed");
    process.exit(1);
  }
  const client = postgres(url, { max: 1, prepare: false });
  try {
    const summary = await seedDemo(drizzle(client, { schema }));
    console.log(`Готово: ${summary}.`);
  } finally {
    await client.end();
  }
}

// запуск из командной строки: npm run db:seed (при импорте в тестах main не вызывается)
if (process.argv[1]?.replace(/\\/g, "/").endsWith("db/seed.ts")) {
  main().catch((error) => {
    console.error("Не удалось залить демо-данные:", error);
    process.exit(1);
  });
}
