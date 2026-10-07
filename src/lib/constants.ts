import type {
  ClientStatus,
  DealStageId,
  LeadSource,
  LeadStatus,
  OpenStageId,
  Priority,
  Role,
} from "@/types/crm";

export const APP_NAME = "Nexora";

/* ───────────── Этапы сделок ───────────── */

export interface StageMeta {
  id: DealStageId;
  label: string;
  /** CSS-переменная цвета этапа (порядковая шкала, отдельная для тёмной темы) */
  color: string;
  closed: boolean;
  /** вероятность закрытия для взвешенного прогноза */
  probability: number;
}

export const STAGES: StageMeta[] = [
  { id: "new", label: "Новый лид", color: "var(--stage-new)", closed: false, probability: 0.1 },
  { id: "contact", label: "Контакт", color: "var(--stage-contact)", closed: false, probability: 0.2 },
  { id: "qualification", label: "Квалификация", color: "var(--stage-qualification)", closed: false, probability: 0.35 },
  { id: "proposal", label: "Предложение", color: "var(--stage-proposal)", closed: false, probability: 0.55 },
  { id: "negotiation", label: "Переговоры", color: "var(--stage-negotiation)", closed: false, probability: 0.75 },
  { id: "won", label: "Успешно", color: "var(--stage-won)", closed: true, probability: 1 },
  { id: "lost", label: "Провалено", color: "var(--stage-lost)", closed: true, probability: 0 },
];

export const OPEN_STAGES = STAGES.filter((s) => !s.closed).map((s) => s.id) as OpenStageId[];

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<DealStageId, StageMeta>;

/**
 * Шаги воронки на дашборде. stageReached сделки хранит индекс
 * максимального пройденного шага (0 — новый … 6 — оплачено).
 */
export const FUNNEL_STEPS = [
  { key: "leads", label: "Лиды" },
  { key: "contact", label: "Контакт" },
  { key: "qualification", label: "Квалификация" },
  { key: "proposal", label: "Предложение" },
  { key: "negotiation", label: "Переговоры" },
  { key: "contract", label: "Сделка" },
  { key: "won", label: "Успешно" },
] as const;

export const STAGE_REACH: Record<DealStageId, number> = {
  new: 0,
  contact: 1,
  qualification: 2,
  proposal: 3,
  negotiation: 4,
  won: 6,
  lost: 0,
};
export const REACH_CONTRACT = 5;

export const LOST_REASONS = [
  "Дорого",
  "Выбрали другого подрядчика",
  "Нет бюджета",
  "Не выходит на связь",
  "Отложили проект",
  "Другое",
] as const;

/* ───────────── Источники ───────────── */

export interface SourceMeta {
  id: LeadSource;
  label: string;
  /** для фраз «заявка из Instagram», «заявка с сайта» */
  from: string;
  color: string;
}

/** Порядок фиксирован: цвета подобраны так, чтобы соседние сегменты различались */
export const SOURCES: SourceMeta[] = [
  { id: "instagram", label: "Instagram", from: "из Instagram", color: "var(--src-instagram)" },
  { id: "max", label: "MAX", from: "из MAX", color: "var(--src-max)" },
  { id: "website", label: "Сайт", from: "с сайта", color: "var(--src-website)" },
  { id: "telegram", label: "Telegram", from: "из Telegram", color: "var(--src-telegram)" },
  { id: "whatsapp", label: "WhatsApp", from: "из WhatsApp", color: "var(--src-whatsapp)" },
  { id: "vk", label: "VK", from: "из VK", color: "var(--src-vk)" },
  { id: "referral", label: "Рекомендации", from: "по рекомендации", color: "var(--src-referral)" },
  { id: "other", label: "Другое", from: "из другого канала", color: "var(--src-other)" },
];

export const SOURCE_BY_ID = Object.fromEntries(SOURCES.map((s) => [s.id, s])) as Record<LeadSource, SourceMeta>;

/** Источники, которые показываются отдельными сегментами на кольцевой диаграмме */
export const DONUT_SOURCES: LeadSource[] = ["instagram", "max", "website", "telegram", "whatsapp"];

/* ───────────── Приоритеты и статусы ───────────── */

export const PRIORITIES: Record<Priority, { label: string; color: string; rank: number }> = {
  high: { label: "Высокий", color: "var(--destructive)", rank: 3 },
  medium: { label: "Средний", color: "var(--warning)", rank: 2 },
  low: { label: "Низкий", color: "var(--src-other)", rank: 1 },
};

export const LEAD_STATUSES: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: "Новый", color: "var(--primary)" },
  contacted: { label: "В работе", color: "var(--stage-contact)" },
  qualified: { label: "Квалифицирован", color: "var(--stage-proposal)" },
  converted: { label: "Сделка", color: "var(--success)" },
  disqualified: { label: "Отказ", color: "var(--src-other)" },
};

export const CLIENT_STATUSES: Record<ClientStatus, { label: string; color: string }> = {
  new: { label: "Новый", color: "var(--primary)" },
  active: { label: "Активный", color: "var(--success)" },
  vip: { label: "Ключевой", color: "var(--src-referral)" },
  inactive: { label: "Неактивный", color: "var(--src-other)" },
};

export const ROLES: Record<Role, { label: string; description: string }> = {
  owner: { label: "Владелец", description: "Полный доступ, оплата и удаление пространства" },
  admin: { label: "Администратор", description: "Управляет командой, настройками и автоматизациями" },
  manager: { label: "Менеджер", description: "Ведёт свои и общие сделки, видит аналитику отдела" },
  employee: { label: "Сотрудник", description: "Работает со своими задачами и клиентами" },
};

export const INDUSTRIES = [
  "Маркетинг и digital",
  "Услуги для бизнеса",
  "Розница и e-commerce",
  "Медицина и красота",
  "Образование",
  "Недвижимость и стройка",
  "Производство",
  "Другое",
] as const;

export const TEAM_SIZES = ["Только я", "2–5", "6–20", "21–50", "50+"] as const;

/** Клиент «неактивен», если не было активности дольше этого срока */
export const INACTIVE_AFTER_DAYS = 180;
/** Клиент становится ключевым, когда сумма успешных сделок достигает этой отметки */
export const KEY_CLIENT_REVENUE = 300_000;
/** Сделка «зависла», если по ней нет активности дольше этого срока */
export const STALE_DEAL_DAYS = 7;
/** Лид считается неотвеченным через столько минут */
export const LEAD_RESPONSE_SLA_MIN = 30;
