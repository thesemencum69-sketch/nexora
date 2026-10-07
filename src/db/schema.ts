/**
 * Схема базы данных Nexora (PostgreSQL + Drizzle ORM).
 *
 * Принципы:
 * 1. Мультиарендность: у каждой таблицы с данными компании есть workspace_id,
 *    и все запросы фильтруются по нему (см. src/server/tenant.ts).
 * 2. Связи «внутри компании» закреплены составными внешними ключами
 *    (workspace_id, id): база сама не даст привязать сделку к клиенту или
 *    сотруднику из другой компании, даже если в коде будет ошибка.
 * 3. Деньги — целые копейки (bigint), без ошибок округления float.
 * 4. Время — timestamptz, в интерфейсе показывается в часовом поясе компании.
 *
 * Сущности повторяют доменную модель из src/types/crm.ts.
 */
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AutomationAction, AutomationCondition, AutomationTrigger, CustomValues, Requisites } from "@/types/crm";

/* ───────────── Перечисления ───────────── */

export const roleEnum = pgEnum("role", ["owner", "admin", "manager", "employee"]);
export const planEnum = pgEnum("plan", ["free", "pro", "business"]);
export const dealStageEnum = pgEnum("deal_stage", ["new", "contact", "qualification", "proposal", "negotiation", "won", "lost"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high"]);
export const leadSourceEnum = pgEnum("lead_source", ["instagram", "max", "website", "telegram", "whatsapp", "vk", "referral", "other"]);
export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "qualified", "converted", "disqualified"]);
export const taskStatusEnum = pgEnum("task_status", ["open", "done"]);
export const activityTypeEnum = pgEnum("activity_type", [
  "lead_created",
  "deal_created",
  "deal_stage_changed",
  "deal_won",
  "deal_lost",
  "client_created",
  "task_completed",
  "comment",
  "automation",
  "document_issued",
  "document_paid",
]);
export const notificationTypeEnum = pgEnum("notification_type", ["lead", "task", "task_overdue", "deal", "comment", "automation"]);
export const integrationProviderEnum = pgEnum("integration_provider", ["telegram", "whatsapp", "max", "email", "google_calendar", "website", "webhook"]);
export const integrationStatusEnum = pgEnum("integration_status", ["connected", "disconnected", "error"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["trialing", "active", "past_due", "canceled"]);
export const billingPeriodEnum = pgEnum("billing_period", ["monthly", "yearly"]);
export const automationRunStatusEnum = pgEnum("automation_run_status", ["success", "skipped", "failed"]);
export const channelEnum = pgEnum("channel", ["telegram", "max", "whatsapp", "vk", "instagram", "website"]);
export const messageDirectionEnum = pgEnum("message_direction", ["in", "out"]);
export const customFieldTypeEnum = pgEnum("custom_field_type", ["text", "number", "select", "date"]);
export const customFieldEntityEnum = pgEnum("custom_field_entity", ["deal", "client"]);
export const documentKindEnum = pgEnum("document_kind", ["invoice", "proposal"]);
export const documentStatusEnum = pgEnum("document_status", ["issued", "paid", "canceled"]);
export const viewEntityEnum = pgEnum("view_entity", ["deals", "clients", "leads"]);

/* ───────────── Общие колонки ───────────── */

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const workspaceId = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });
/** Сумма в копейках; mode number безопасен до 90 трлн ₽ */
const money = (name: string) => bigint(name, { mode: "number" });

/* ───────────── Пользователи и доступ ───────────── */

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    /** argon2id/bcrypt-хеш; null — вход только через OAuth */
    passwordHash: text("password_hash"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    /** оттенок аватара 0–360 */
    avatarHue: smallint("avatar_hue").notNull().default(260),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_unique").on(sql`lower(${t.email})`)],
);

/** Сессии: в cookie лежит случайный токен, в базе — только его SHA-256 */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    /** последнее открытое пространство — для переключателя компаний */
    activeWorkspaceId: uuid("active_workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_token_unique").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

/** Вход через Google и других OAuth-провайдеров */
export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("oauth_provider_account_unique").on(t.provider, t.providerAccountId), index("oauth_user_idx").on(t.userId)],
);

/* ───────────── Компании (рабочие пространства) ───────────── */

export const workspaces = pgTable(
  "workspaces",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    industry: text("industry").notNull().default("Другое"),
    size: text("size").notNull().default("2–5"),
    sources: leadSourceEnum("sources").array().notNull().default(sql`'{}'::lead_source[]`),
    plan: planEnum("plan").notNull().default("free"),
    currency: text("currency").notNull().default("RUB"),
    timezone: text("timezone").notNull().default("Europe/Moscow"),
    /** реквизиты для счетов: ИНН, КПП, банк, расчётный счёт, подписант */
    requisites: jsonb("requisites").$type<Partial<Requisites>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("workspaces_slug_unique").on(t.slug)],
);

/** Участник компании. Все «ответственные» в CRM ссылаются сюда, а не на users */
export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    workspaceId: workspaceId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("employee"),
    position: text("position").notNull().default(""),
    joinedAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("memberships_workspace_user_unique").on(t.workspaceId, t.userId),
    unique("memberships_workspace_id_unique").on(t.workspaceId, t.id),
    index("memberships_user_idx").on(t.userId),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    workspaceId: workspaceId(),
    email: text("email").notNull(),
    role: roleEnum("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedById: uuid("invited_by_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("invitations_token_unique").on(t.tokenHash),
    index("invitations_workspace_email_idx").on(t.workspaceId, sql`lower(${t.email})`),
    foreignKey({ name: "invitations_inviter_fk", columns: [t.workspaceId, t.invitedById], foreignColumns: [memberships.workspaceId, memberships.id] }),
    check("invitations_role_not_owner", sql`${t.role} <> 'owner'`),
  ],
);

/** Подписи этапов и вероятность закрытия — у каждой компании свои */
export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: id(),
    workspaceId: workspaceId(),
    stage: dealStageEnum("stage").notNull(),
    label: text("label").notNull(),
    /** вероятность закрытия, 0–100 % — основа взвешенного прогноза */
    probability: smallint("probability").notNull(),
    position: smallint("position").notNull(),
  },
  (t) => [
    uniqueIndex("pipeline_stages_workspace_stage_unique").on(t.workspaceId, t.stage),
    check("pipeline_stages_probability_range", sql`${t.probability} between 0 and 100`),
  ],
);

/* ───────────── CRM: клиенты, лиды, сделки ───────────── */

export const clients = pgTable(
  "clients",
  {
    id: id(),
    workspaceId: workspaceId(),
    name: text("name").notNull(),
    company: text("company").notNull().default(""),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    /** только цифры телефона — для поиска дублей при вводе */
    phoneDigits: text("phone_digits").notNull().default(""),
    city: text("city").notNull().default(""),
    ownerId: uuid("owner_id").notNull(),
    source: leadSourceEnum("source").notNull().default("other"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    /** значения своих полей: { [custom_field_id]: значение } */
    custom: jsonb("custom").$type<CustomValues>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("clients_workspace_id_unique").on(t.workspaceId, t.id),
    foreignKey({ name: "clients_owner_fk", columns: [t.workspaceId, t.ownerId], foreignColumns: [memberships.workspaceId, memberships.id] }),
    index("clients_workspace_activity_idx").on(t.workspaceId, t.lastActivityAt.desc()),
    index("clients_workspace_owner_idx").on(t.workspaceId, t.ownerId),
    index("clients_workspace_email_idx").on(t.workspaceId, sql`lower(${t.email})`),
    index("clients_workspace_phone_idx").on(t.workspaceId, t.phoneDigits),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: id(),
    workspaceId: workspaceId(),
    name: text("name").notNull(),
    company: text("company").notNull().default(""),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    phoneDigits: text("phone_digits").notNull().default(""),
    source: leadSourceEnum("source").notNull(),
    status: leadStatusEnum("status").notNull().default("new"),
    ownerId: uuid("owner_id"),
    message: text("message").notNull().default(""),
    budget: money("budget_kopecks"),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    /** ссылка на сделку без FK: сделка ссылается на лид, цикл ключей не нужен */
    dealId: uuid("deal_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("leads_workspace_id_unique").on(t.workspaceId, t.id),
    foreignKey({ name: "leads_owner_fk", columns: [t.workspaceId, t.ownerId], foreignColumns: [memberships.workspaceId, memberships.id] }),
    index("leads_workspace_status_idx").on(t.workspaceId, t.status, t.createdAt.desc()),
    index("leads_workspace_source_idx").on(t.workspaceId, t.source, t.createdAt.desc()),
    index("leads_workspace_phone_idx").on(t.workspaceId, t.phoneDigits),
  ],
);

export const deals = pgTable(
  "deals",
  {
    id: id(),
    workspaceId: workspaceId(),
    title: text("title").notNull(),
    clientId: uuid("client_id").notNull(),
    amount: money("amount_kopecks").notNull().default(0),
    stage: dealStageEnum("stage").notNull().default("new"),
    /** максимальный достигнутый шаг воронки — для честной воронки по закрытым сделкам */
    stageReached: smallint("stage_reached").notNull().default(0),
    ownerId: uuid("owner_id").notNull(),
    priority: priorityEnum("priority").notNull().default("medium"),
    source: leadSourceEnum("source").notNull().default("other"),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    lostReason: text("lost_reason"),
    expectedCloseAt: date("expected_close_at", { mode: "string" }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    custom: jsonb("custom").$type<CustomValues>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("deals_workspace_id_unique").on(t.workspaceId, t.id),
    foreignKey({ name: "deals_client_fk", columns: [t.workspaceId, t.clientId], foreignColumns: [clients.workspaceId, clients.id] }).onDelete("cascade"),
    foreignKey({ name: "deals_owner_fk", columns: [t.workspaceId, t.ownerId], foreignColumns: [memberships.workspaceId, memberships.id] }),
    index("deals_workspace_stage_idx").on(t.workspaceId, t.stage),
    index("deals_workspace_owner_idx").on(t.workspaceId, t.ownerId),
    index("deals_workspace_client_idx").on(t.workspaceId, t.clientId),
    index("deals_workspace_closed_idx").on(t.workspaceId, t.closedAt),
    check("deals_amount_non_negative", sql`${t.amount} >= 0`),
    check("deals_closed_consistency", sql`(${t.stage} in ('won', 'lost')) = (${t.closedAt} is not null)`),
  ],
);

/** История переходов по этапам — основа отчётов по воронке и циклу сделки */
export const dealStageHistory = pgTable(
  "deal_stage_history",
  {
    id: id(),
    workspaceId: workspaceId(),
    dealId: uuid("deal_id").notNull(),
    fromStage: dealStageEnum("from_stage"),
    toStage: dealStageEnum("to_stage").notNull(),
    changedById: uuid("changed_by_id"),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: "deal_stage_history_deal_fk", columns: [t.workspaceId, t.dealId], foreignColumns: [deals.workspaceId, deals.id] }).onDelete("cascade"),
    index("deal_stage_history_deal_idx").on(t.workspaceId, t.dealId, t.changedAt),
  ],
);

/* ───────────── Задачи, заметки, лента ───────────── */

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    workspaceId: workspaceId(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    assigneeId: uuid("assignee_id").notNull(),
    priority: priorityEnum("priority").notNull().default("medium"),
    status: taskStatusEnum("status").notNull().default("open"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** при удалении сделки задача остаётся, связь обнуляется */
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    createdById: uuid("created_by_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({ name: "tasks_assignee_fk", columns: [t.workspaceId, t.assigneeId], foreignColumns: [memberships.workspaceId, memberships.id] }),
    index("tasks_workspace_assignee_idx").on(t.workspaceId, t.assigneeId, t.status, t.dueAt),
    index("tasks_workspace_due_idx").on(t.workspaceId, t.status, t.dueAt),
    index("tasks_deal_idx").on(t.dealId),
    check("tasks_done_consistency", sql`(${t.status} = 'done') = (${t.completedAt} is not null)`),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: id(),
    workspaceId: workspaceId(),
    body: text("body").notNull(),
    authorId: uuid("author_id").notNull(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ name: "notes_author_fk", columns: [t.workspaceId, t.authorId], foreignColumns: [memberships.workspaceId, memberships.id] }),
    index("notes_client_idx").on(t.workspaceId, t.clientId, t.createdAt.desc()),
    index("notes_deal_idx").on(t.workspaceId, t.dealId, t.createdAt.desc()),
    check("notes_body_length", sql`char_length(${t.body}) <= 4000`),
  ],
);

export interface ActivityMeta {
  from?: string;
  to?: string;
  text?: string;
  title?: string;
  name?: string;
  amount?: number;
  source?: string;
}

/** Лента событий. actor_id = null — системное событие (заявка с сайта, автоматизация) */
export const activities = pgTable(
  "activities",
  {
    id: id(),
    workspaceId: workspaceId(),
    type: activityTypeEnum("type").notNull(),
    actorId: uuid("actor_id").references(() => memberships.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    meta: jsonb("meta").$type<ActivityMeta>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("activities_workspace_created_idx").on(t.workspaceId, t.createdAt.desc()),
    index("activities_client_idx").on(t.workspaceId, t.clientId, t.createdAt.desc()),
    index("activities_deal_idx").on(t.workspaceId, t.dealId, t.createdAt.desc()),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    workspaceId: workspaceId(),
    recipientId: uuid("recipient_id").notNull(),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href"),
    actorId: uuid("actor_id").references(() => memberships.id, { onDelete: "set null" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ name: "notifications_recipient_fk", columns: [t.workspaceId, t.recipientId], foreignColumns: [memberships.workspaceId, memberships.id] }).onDelete("cascade"),
    index("notifications_recipient_idx").on(t.recipientId, t.readAt, t.createdAt.desc()),
  ],
);

/* ───────────── Переписка ───────────── */

/** Диалог с человеком в одном канале. Привязывается к лиду, затем к клиенту и сделке */
export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    workspaceId: workspaceId(),
    channel: channelEnum("channel").notNull(),
    contactName: text("contact_name").notNull(),
    /** @username, телефон или email — адрес в канале */
    handle: text("handle").notNull(),
    /** id чата у провайдера: по нему входящие находят свой диалог */
    externalId: text("external_id"),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    ownerId: uuid("owner_id"),
    unread: integer("unread").notNull().default(0),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("conversations_workspace_id_unique").on(t.workspaceId, t.id),
    foreignKey({ name: "conversations_owner_fk", columns: [t.workspaceId, t.ownerId], foreignColumns: [memberships.workspaceId, memberships.id] }),
    uniqueIndex("conversations_external_unique").on(t.workspaceId, t.channel, t.externalId),
    index("conversations_workspace_last_idx").on(t.workspaceId, t.lastMessageAt.desc()),
    index("conversations_client_idx").on(t.workspaceId, t.clientId),
    index("conversations_deal_idx").on(t.workspaceId, t.dealId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    workspaceId: workspaceId(),
    conversationId: uuid("conversation_id").notNull(),
    direction: messageDirectionEnum("direction").notNull(),
    /** сотрудник для исходящих; null — клиент или автоответ */
    authorId: uuid("author_id").references(() => memberships.id, { onDelete: "set null" }),
    text: text("text").notNull(),
    auto: boolean("auto").notNull().default(false),
    /** id сообщения у провайдера — защита от повторной доставки вебхука */
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ name: "messages_conversation_fk", columns: [t.workspaceId, t.conversationId], foreignColumns: [conversations.workspaceId, conversations.id] }).onDelete("cascade"),
    index("messages_conversation_idx").on(t.workspaceId, t.conversationId, t.createdAt),
    uniqueIndex("messages_external_unique").on(t.conversationId, t.externalId),
    check("messages_text_length", sql`char_length(${t.text}) <= 4096`),
  ],
);

export const replyTemplates = pgTable(
  "reply_templates",
  {
    id: id(),
    workspaceId: workspaceId(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    position: smallint("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("reply_templates_workspace_idx").on(t.workspaceId, t.position)],
);

/* ───────────── Свои поля, товары, документы ───────────── */

export const customFields = pgTable(
  "custom_fields",
  {
    id: id(),
    workspaceId: workspaceId(),
    entity: customFieldEntityEnum("entity").notNull(),
    label: text("label").notNull(),
    type: customFieldTypeEnum("type").notNull(),
    options: text("options").array().notNull().default(sql`'{}'::text[]`),
    position: smallint("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("custom_fields_workspace_idx").on(t.workspaceId, t.entity, t.position)],
);

export const products = pgTable(
  "products",
  {
    id: id(),
    workspaceId: workspaceId(),
    name: text("name").notNull(),
    price: money("price_kopecks").notNull().default(0),
    unit: text("unit").notNull().default("шт."),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("products_workspace_idx").on(t.workspaceId, t.archived), check("products_price_non_negative", sql`${t.price} >= 0`)],
);

/** Позиции сделки. Сумма сделки = сумма позиций, если они есть */
export const dealItems = pgTable(
  "deal_items",
  {
    id: id(),
    workspaceId: workspaceId(),
    dealId: uuid("deal_id").notNull(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    price: money("price_kopecks").notNull(),
    qty: integer("qty").notNull().default(1),
    unit: text("unit").notNull().default("шт."),
    position: smallint("position").notNull().default(0),
  },
  (t) => [
    foreignKey({ name: "deal_items_deal_fk", columns: [t.workspaceId, t.dealId], foreignColumns: [deals.workspaceId, deals.id] }).onDelete("cascade"),
    index("deal_items_deal_idx").on(t.workspaceId, t.dealId, t.position),
    check("deal_items_qty_positive", sql`${t.qty} > 0`),
    check("deal_items_price_non_negative", sql`${t.price} >= 0`),
  ],
);

export interface DocumentItemSnapshot {
  name: string;
  /** копейки */
  price: number;
  qty: number;
  unit: string;
}

/**
 * Счета и коммерческие предложения. Позиции и реквизиты сохраняются снимком:
 * выставленный документ не меняется, даже если потом поменяли сделку или реквизиты.
 */
export const documents = pgTable(
  "documents",
  {
    id: id(),
    workspaceId: workspaceId(),
    kind: documentKindEnum("kind").notNull(),
    number: integer("number").notNull(),
    dealId: uuid("deal_id").notNull(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    items: jsonb("items").$type<DocumentItemSnapshot[]>().notNull(),
    total: money("total_kopecks").notNull(),
    requisites: jsonb("requisites").$type<Partial<Requisites>>().notNull().default({}),
    status: documentStatusEnum("status").notNull().default("issued"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => memberships.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ name: "documents_deal_fk", columns: [t.workspaceId, t.dealId], foreignColumns: [deals.workspaceId, deals.id] }).onDelete("cascade"),
    uniqueIndex("documents_number_unique").on(t.workspaceId, t.kind, t.number),
    index("documents_deal_idx").on(t.workspaceId, t.dealId, t.createdAt.desc()),
    check("documents_paid_consistency", sql`(${t.status} = 'paid') = (${t.paidAt} is not null)`),
  ],
);

/* ───────────── Планы, виды, импорт ───────────── */

/** План продаж менеджера на календарный месяц (первое число месяца) */
export const salesPlans = pgTable(
  "sales_plans",
  {
    id: id(),
    workspaceId: workspaceId(),
    memberId: uuid("member_id").notNull(),
    month: date("month", { mode: "string" }).notNull(),
    amount: money("amount_kopecks").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({ name: "sales_plans_member_fk", columns: [t.workspaceId, t.memberId], foreignColumns: [memberships.workspaceId, memberships.id] }).onDelete("cascade"),
    uniqueIndex("sales_plans_member_month_unique").on(t.workspaceId, t.memberId, t.month),
    check("sales_plans_month_first_day", sql`extract(day from ${t.month}) = 1`),
    check("sales_plans_amount_positive", sql`${t.amount} > 0`),
  ],
);

/** Сохранённые фильтры списков — общие для команды */
export const savedViews = pgTable(
  "saved_views",
  {
    id: id(),
    workspaceId: workspaceId(),
    entity: viewEntityEnum("entity").notNull(),
    name: text("name").notNull(),
    filters: jsonb("filters").$type<Record<string, string>>().notNull().default({}),
    createdById: uuid("created_by_id").references(() => memberships.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("saved_views_workspace_idx").on(t.workspaceId, t.entity)],
);

/** Загрузки из файлов. Списки id нужны, чтобы отменить импорт целиком */
export const imports = pgTable(
  "imports",
  {
    id: id(),
    workspaceId: workspaceId(),
    fileName: text("file_name").notNull(),
    clientIds: uuid("client_ids").array().notNull().default(sql`'{}'::uuid[]`),
    dealIds: uuid("deal_ids").array().notNull().default(sql`'{}'::uuid[]`),
    leadIds: uuid("lead_ids").array().notNull().default(sql`'{}'::uuid[]`),
    createdById: uuid("created_by_id").references(() => memberships.id, { onDelete: "set null" }),
    undoneAt: timestamp("undone_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("imports_workspace_idx").on(t.workspaceId, t.createdAt.desc())],
);

/* ───────────── Автоматизации ───────────── */

export const automations = pgTable(
  "automations",
  {
    id: id(),
    workspaceId: workspaceId(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    active: boolean("active").notNull().default(true),
    trigger: jsonb("trigger").$type<AutomationTrigger>().notNull(),
    conditions: jsonb("conditions").$type<AutomationCondition[]>().notNull().default([]),
    actions: jsonb("actions").$type<AutomationAction[]>().notNull().default([]),
    runs: integer("runs").notNull().default(0),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdById: uuid("created_by_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("automations_workspace_active_idx").on(t.workspaceId, t.active)],
);

/** Журнал срабатываний: что сделала автоматизация и почему пропустила */
export const automationRuns = pgTable(
  "automation_runs",
  {
    id: id(),
    workspaceId: workspaceId(),
    automationId: uuid("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    status: automationRunStatusEnum("status").notNull(),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("automation_runs_automation_idx").on(t.workspaceId, t.automationId, t.createdAt.desc())],
);

/* ───────────── Интеграции и оплата ───────────── */

export const integrations = pgTable(
  "integrations",
  {
    id: id(),
    workspaceId: workspaceId(),
    provider: integrationProviderEnum("provider").notNull(),
    status: integrationStatusEnum("status").notNull().default("disconnected"),
    /** публичные настройки: имя бота, адрес формы, события вебхука */
    config: jsonb("config").$type<Record<string, string>>().notNull().default({}),
    /** токены и ключи — только в зашифрованном виде (AES-GCM на стороне приложения) */
    secretEncrypted: text("secret_encrypted"),
    connectedById: uuid("connected_by_id"),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("integrations_workspace_provider_unique").on(t.workspaceId, t.provider)],
);

/**
 * Подписка компании. Платёжный провайдер (Stripe, ЮKassa, CloudPayments)
 * хранится строкой: интерфейс тарифов не зависит от выбора провайдера.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    workspaceId: workspaceId(),
    plan: planEnum("plan").notNull(),
    status: subscriptionStatusEnum("status").notNull().default("trialing"),
    billingPeriod: billingPeriodEnum("billing_period").notNull().default("yearly"),
    seats: integer("seats").notNull().default(1),
    provider: text("provider"),
    providerCustomerId: text("provider_customer_id"),
    providerSubscriptionId: text("provider_subscription_id"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAt: timestamp("cancel_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("subscriptions_workspace_unique").on(t.workspaceId),
    uniqueIndex("subscriptions_provider_unique").on(t.provider, t.providerSubscriptionId),
  ],
);

/** Журнал действий: кто, что и когда менял — для безопасности и разбора спорных случаев */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    workspaceId: workspaceId(),
    actorId: uuid("actor_id").references(() => memberships.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_workspace_created_idx").on(t.workspaceId, t.createdAt.desc())],
);

/* ───────────── Связи для удобных запросов ───────────── */

export const workspacesRelations = relations(workspaces, ({ many, one }) => ({
  memberships: many(memberships),
  clients: many(clients),
  leads: many(leads),
  deals: many(deals),
  tasks: many(tasks),
  automations: many(automations),
  subscription: one(subscriptions),
}));

export const usersRelations = relations(users, ({ many }) => ({ memberships: many(memberships), sessions: many(sessions) }));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  workspace: one(workspaces, { fields: [memberships.workspaceId], references: [workspaces.id] }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  owner: one(memberships, { fields: [clients.ownerId], references: [memberships.id] }),
  deals: many(deals),
  notes: many(notes),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  client: one(clients, { fields: [deals.clientId], references: [clients.id] }),
  owner: one(memberships, { fields: [deals.ownerId], references: [memberships.id] }),
  lead: one(leads, { fields: [deals.leadId], references: [leads.id] }),
  history: many(dealStageHistory),
  tasks: many(tasks),
  items: many(dealItems),
  documents: many(documents),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  messages: many(messages),
  lead: one(leads, { fields: [conversations.leadId], references: [leads.id] }),
  client: one(clients, { fields: [conversations.clientId], references: [clients.id] }),
  deal: one(deals, { fields: [conversations.dealId], references: [deals.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));

export const dealItemsRelations = relations(dealItems, ({ one }) => ({
  deal: one(deals, { fields: [dealItems.dealId], references: [deals.id] }),
  product: one(products, { fields: [dealItems.productId], references: [products.id] }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  deal: one(deals, { fields: [documents.dealId], references: [deals.id] }),
  client: one(clients, { fields: [documents.clientId], references: [clients.id] }),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  owner: one(memberships, { fields: [leads.ownerId], references: [memberships.id] }),
  client: one(clients, { fields: [leads.clientId], references: [clients.id] }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  assignee: one(memberships, { fields: [tasks.assigneeId], references: [memberships.id] }),
  deal: one(deals, { fields: [tasks.dealId], references: [deals.id] }),
  client: one(clients, { fields: [tasks.clientId], references: [clients.id] }),
}));

export const dealStageHistoryRelations = relations(dealStageHistory, ({ one }) => ({
  deal: one(deals, { fields: [dealStageHistory.dealId], references: [deals.id] }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  client: one(clients, { fields: [notes.clientId], references: [clients.id] }),
  deal: one(deals, { fields: [notes.dealId], references: [deals.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  workspace: one(workspaces, { fields: [subscriptions.workspaceId], references: [workspaces.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));
