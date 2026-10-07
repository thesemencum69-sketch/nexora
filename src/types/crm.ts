/**
 * Доменная модель Nexora (UI-слой).
 * Схема БД в src/db/schema.ts повторяет эти сущности и добавляет workspaceId
 * для изоляции данных между компаниями.
 */

export type ID = string;
/** ISO-8601 строка — сериализуется в JSON без потерь */
export type ISODate = string;

export type Role = "owner" | "admin" | "manager" | "employee";
export type Gender = "m" | "f";
export type PlanId = "free" | "pro" | "business";

export type DealStageId = "new" | "contact" | "qualification" | "proposal" | "negotiation" | "won" | "lost";
export type OpenStageId = Exclude<DealStageId, "won" | "lost">;
export type Priority = "low" | "medium" | "high";

export type LeadSource = "instagram" | "max" | "website" | "telegram" | "whatsapp" | "vk" | "referral" | "other";
export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "disqualified";
export type ClientStatus = "new" | "active" | "vip" | "inactive";

export interface Workspace {
  id: ID;
  name: string;
  industry: string;
  size: string;
  sources: LeadSource[];
  plan: PlanId;
  currency: "RUB";
  timezone: string;
  createdAt: ISODate;
  /** названия и вероятности этапов воронки этой компании */
  pipeline: StageSetting[];
  /** реквизиты для счетов */
  requisites: Requisites;
}

export interface StageSetting {
  id: DealStageId;
  label: string;
  /** 0–1 */
  probability: number;
}

export type VatMode = "none" | "vat5" | "vat7" | "vat20";

export interface Requisites {
  legalName: string;
  inn: string;
  kpp: string;
  address: string;
  bank: string;
  bik: string;
  account: string;
  corrAccount: string;
  director: string;
  vat: VatMode;
  /** демо-реквизиты: показываем предупреждение в документах */
  sample: boolean;
}

export interface Member {
  id: ID;
  name: string;
  email: string;
  phone: string;
  position: string;
  role: Role;
  gender: Gender;
  /** оттенок аватара 0–360, стабилен для человека */
  hue: number;
  online: boolean;
  joinedAt: ISODate;
}

/** Значения своих полей: id поля → значение строкой (числа и даты тоже храним строкой) */
export type CustomValues = Record<ID, string>;

export interface Client {
  id: ID;
  name: string;
  gender: Gender;
  /** пусто — частное лицо */
  company: string;
  email: string;
  phone: string;
  city: string;
  ownerId: ID;
  source: LeadSource;
  tags: string[];
  createdAt: ISODate;
  lastActivityAt: ISODate;
  custom?: CustomValues;
}

export interface Lead {
  id: ID;
  name: string;
  gender: Gender;
  company: string;
  email: string;
  phone: string;
  source: LeadSource;
  status: LeadStatus;
  ownerId: ID | null;
  message: string;
  budget: number | null;
  createdAt: ISODate;
  firstResponseAt: ISODate | null;
  convertedAt: ISODate | null;
  clientId: ID | null;
  dealId: ID | null;
}

export interface StageChange {
  stage: DealStageId;
  at: ISODate;
}

export interface Deal {
  id: ID;
  title: string;
  clientId: ID;
  amount: number;
  stage: DealStageId;
  /** максимальный достигнутый шаг воронки (см. FUNNEL_STEPS) */
  stageReached: number;
  ownerId: ID;
  priority: Priority;
  source: LeadSource;
  leadId: ID | null;
  lostReason: string | null;
  createdAt: ISODate;
  updatedAt: ISODate;
  lastActivityAt: ISODate;
  expectedCloseAt: ISODate;
  closedAt: ISODate | null;
  /** история переходов по этапам — основа для отчётов по воронке */
  stageHistory: StageChange[];
  custom?: CustomValues;
  /** товары и услуги; если есть, сумма сделки считается по ним */
  items?: DealItem[];
}

export interface DealItem {
  id: ID;
  productId: ID | null;
  name: string;
  price: number;
  qty: number;
  unit: string;
}

export type TaskStatus = "open" | "done";

export interface Task {
  id: ID;
  title: string;
  description: string;
  assigneeId: ID;
  priority: Priority;
  status: TaskStatus;
  dueAt: ISODate;
  completedAt: ISODate | null;
  dealId: ID | null;
  clientId: ID | null;
  leadId: ID | null;
  createdBy: ID | null;
  createdAt: ISODate;
}

export type ActivityType =
  | "lead_created"
  | "deal_created"
  | "deal_stage_changed"
  | "deal_won"
  | "deal_lost"
  | "client_created"
  | "task_completed"
  | "comment"
  | "automation"
  | "document_issued"
  | "document_paid";

export interface Activity {
  id: ID;
  type: ActivityType;
  /** null — системное событие (заявка с сайта, автоматизация) */
  actorId: ID | null;
  createdAt: ISODate;
  dealId?: ID | null;
  clientId?: ID | null;
  leadId?: ID | null;
  taskId?: ID | null;
  meta?: {
    from?: DealStageId;
    to?: DealStageId;
    text?: string;
    title?: string;
    name?: string;
    amount?: number;
    source?: LeadSource;
    gender?: Gender;
    kind?: DocumentKind;
    number?: number;
  };
}

export interface Note {
  id: ID;
  body: string;
  authorId: ID;
  clientId: ID | null;
  dealId: ID | null;
  createdAt: ISODate;
}

export type NotificationType = "lead" | "task" | "task_overdue" | "deal" | "comment" | "automation";

export interface AppNotification {
  id: ID;
  type: NotificationType;
  title: string;
  body: string;
  href: string | null;
  actorId: ID | null;
  read: boolean;
  createdAt: ISODate;
}

/* ───────────── Автоматизации ───────────── */

export type TriggerType = "deal_created" | "deal_stage_changed" | "deal_won" | "lead_created" | "task_overdue" | "deal_idle";
export type ConditionField = "amount" | "source" | "priority" | "stage" | "owner";
export type ConditionOperator = "gt" | "lt" | "eq" | "neq";
export type ActionType =
  | "create_task"
  | "assign_owner"
  | "notify"
  | "set_priority"
  | "set_lead_status"
  | "send_telegram"
  | "webhook";

export interface AutomationTrigger {
  type: TriggerType;
  stage?: DealStageId;
  days?: number;
}

export interface AutomationCondition {
  id: ID;
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

export interface AutomationAction {
  id: ID;
  type: ActionType;
  params: Record<string, string>;
}

export interface Automation {
  id: ID;
  name: string;
  description: string;
  active: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  runs: number;
  lastRunAt: ISODate | null;
  createdBy: ID;
  createdAt: ISODate;
}

/* ───────────── Переписка ───────────── */

export type Channel = "telegram" | "max" | "whatsapp" | "vk" | "instagram" | "website";

export interface Conversation {
  id: ID;
  channel: Channel;
  contactName: string;
  /** адрес в канале: @username, телефон, email */
  handle: string;
  gender: Gender;
  leadId: ID | null;
  clientId: ID | null;
  dealId: ID | null;
  ownerId: ID | null;
  unread: number;
  lastMessageAt: ISODate;
}

export interface Message {
  id: ID;
  conversationId: ID;
  direction: "in" | "out";
  /** сотрудник для исходящих; null — клиент или автоматизация */
  authorId: ID | null;
  text: string;
  createdAt: ISODate;
  auto?: boolean;
}

export interface ReplyTemplate {
  id: ID;
  title: string;
  body: string;
}

/* ───────────── Свои поля, товары, документы ───────────── */

export type CustomFieldType = "text" | "number" | "select" | "date";
export type CustomFieldEntity = "deal" | "client";

export interface CustomField {
  id: ID;
  entity: CustomFieldEntity;
  label: string;
  type: CustomFieldType;
  options?: string[];
}

export interface Product {
  id: ID;
  name: string;
  price: number;
  unit: string;
}

export type DocumentKind = "invoice" | "proposal";
export type DocumentStatus = "issued" | "paid" | "canceled";

export interface DealDocument {
  id: ID;
  kind: DocumentKind;
  /** сквозной номер внутри вида документа */
  number: number;
  dealId: ID;
  clientId: ID;
  items: DealItem[];
  total: number;
  status: DocumentStatus;
  createdAt: ISODate;
  paidAt: ISODate | null;
  createdBy: ID;
}

/* ───────────── Планы и сохранённые виды ───────────── */

export interface SalesPlan {
  /** месяц в формате 2026-10 */
  month: string;
  memberId: ID;
  amount: number;
}

export type ViewEntity = "deals" | "clients" | "leads";

export interface SavedView {
  id: ID;
  entity: ViewEntity;
  name: string;
  filters: Record<string, string>;
}

export interface ImportBatch {
  id: ID;
  fileName: string;
  at: ISODate;
  clientIds: ID[];
  dealIds: ID[];
  leadIds: ID[];
}

/* ───────────── Корневой снимок данных ───────────── */

export interface CrmData {
  version: number;
  workspace: Workspace;
  currentUserId: ID;
  members: Member[];
  clients: Client[];
  leads: Lead[];
  deals: Deal[];
  tasks: Task[];
  activities: Activity[];
  notes: Note[];
  notifications: AppNotification[];
  automations: Automation[];
  conversations: Conversation[];
  messages: Message[];
  replyTemplates: ReplyTemplate[];
  customFields: CustomField[];
  products: Product[];
  documents: DealDocument[];
  plans: SalesPlan[];
  views: SavedView[];
  imports: ImportBatch[];
}
