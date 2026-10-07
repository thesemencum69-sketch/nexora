/**
 * Проверка схемы без установки PostgreSQL: npm run db:check
 *
 * Поднимает Postgres в памяти (PGlite), применяет миграции из папки drizzle/,
 * заливает демо-данные и проверяет, что база сама отклоняет опасные записи:
 * ссылку на данные чужой компании и закрытую сделку без даты закрытия.
 */
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/db/schema";
import { seedDemo } from "../src/db/seed";

async function expectRejected(label: string, run: () => Promise<unknown>) {
  try {
    await run();
    console.error(`  ✗ ${label}: запись прошла, а не должна была`);
    process.exitCode = 1;
  } catch {
    console.log(`  ✓ ${label}`);
  }
}

async function main() {
  const pg = new PGlite();
  const files = readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    for (const statement of readFileSync(`drizzle/${file}`, "utf8").split("--> statement-breakpoint")) {
      if (statement.trim()) await pg.exec(statement);
    }
  }
  console.log(`Миграции применены: ${files.join(", ")}`);

  const db = drizzle(pg, { schema });
  console.log(`Демо-данные: ${await seedDemo(db as never)}`);
  await seedDemo(db as never);
  console.log("Повторная заливка пересоздаёт демо-компанию без дублей");

  const [demo] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.slug, "demo"));
  const [demoMember] = await db.select().from(schema.memberships).where(eq(schema.memberships.workspaceId, demo!.id)).limit(1);
  const [demoClient] = await db.select().from(schema.clients).where(eq(schema.clients.workspaceId, demo!.id)).limit(1);
  const [demoDeal] = await db.select().from(schema.deals).where(eq(schema.deals.workspaceId, demo!.id)).limit(1);
  const [demoConversation] = await db.select().from(schema.conversations).where(eq(schema.conversations.workspaceId, demo!.id)).limit(1);
  const [demoDocument] = await db.select().from(schema.documents).where(eq(schema.documents.workspaceId, demo!.id)).limit(1);

  const [other] = await db.insert(schema.workspaces).values({ name: "Другая компания", slug: "other-company" }).returning();
  const [user] = await db.insert(schema.users).values({ email: "owner@other-company.ru", name: "Владелец" }).returning();
  const [otherMember] = await db.insert(schema.memberships).values({ workspaceId: other!.id, userId: user!.id, role: "owner" }).returning();

  console.log("Проверки безопасности:");
  await expectRejected("сделка другой компании не может ссылаться на нашего клиента", () =>
    db.insert(schema.deals).values({ workspaceId: other!.id, title: "Чужой клиент", clientId: demoClient!.id, ownerId: otherMember!.id }),
  );
  await expectRejected("ответственным нельзя назначить сотрудника другой компании", () =>
    db.insert(schema.deals).values({ workspaceId: demo!.id, title: "Чужой менеджер", clientId: demoClient!.id, ownerId: otherMember!.id }),
  );
  await expectRejected("задачу нельзя поручить сотруднику другой компании", () =>
    db.insert(schema.tasks).values({ workspaceId: demo!.id, title: "Позвонить", assigneeId: otherMember!.id, dueAt: new Date() }),
  );
  await expectRejected("выигранная сделка без даты закрытия отклоняется", () =>
    db.insert(schema.deals).values({ workspaceId: demo!.id, title: "Без даты", clientId: demoClient!.id, ownerId: demoMember!.id, stage: "won" }),
  );
  await expectRejected("отрицательная сумма сделки отклоняется", () =>
    db.insert(schema.deals).values({ workspaceId: demo!.id, title: "Минус", clientId: demoClient!.id, ownerId: demoMember!.id, amount: -100 }),
  );

  await expectRejected("сообщение нельзя записать в диалог другой компании", () =>
    db.insert(schema.messages).values({ workspaceId: other!.id, conversationId: demoConversation!.id, direction: "out", text: "Здравствуйте" }),
  );
  await expectRejected("план продаж нельзя поставить сотруднику другой компании", () =>
    db.insert(schema.salesPlans).values({ workspaceId: demo!.id, memberId: otherMember!.id, month: "2026-10-01", amount: 100_000_00 }),
  );
  await expectRejected("план ставится только на месяц целиком (первое число)", () =>
    db.insert(schema.salesPlans).values({ workspaceId: demo!.id, memberId: demoMember!.id, month: "2026-10-15", amount: 100_000_00 }),
  );
  await expectRejected("номер счёта не повторяется внутри компании", () =>
    db.insert(schema.documents).values({ workspaceId: demo!.id, kind: demoDocument!.kind, number: demoDocument!.number, dealId: demoDeal!.id, items: [], total: 0 }),
  );
  await expectRejected("оплаченный счёт без даты оплаты отклоняется", () =>
    db.insert(schema.documents).values({ workspaceId: demo!.id, kind: "invoice", number: 99_999, dealId: demoDeal!.id, items: [], total: 0, status: "paid" }),
  );
  await expectRejected("позиция сделки с нулевым количеством отклоняется", () =>
    db.insert(schema.dealItems).values({ workspaceId: demo!.id, dealId: demoDeal!.id, name: "Пусто", price: 100, qty: 0 }),
  );

  await db.delete(schema.workspaces).where(eq(schema.workspaces.id, demo!.id));
  const leftovers = await Promise.all(
    [schema.deals, schema.messages, schema.conversations, schema.documents, schema.salesPlans].map(async (table) => (await db.select({ n: count() }).from(table))[0]!.n),
  );
  const left = leftovers.reduce((a, b) => a + b, 0);
  console.log(left === 0 ? "  ✓ удаление компании удаляет все её данные, включая переписку и документы" : `  ✗ после удаления компании осталось записей: ${left}`);
  if (left !== 0) process.exitCode = 1;

  await pg.close();
  console.log(process.exitCode ? "Есть ошибки" : "Всё в порядке");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
