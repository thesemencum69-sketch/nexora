import type { PlanId } from "@/types/crm";

/**
 * Тарифы вынесены в конфиг: цены и лимиты можно менять без правок кода
 * интерфейса. Цены — ориентир для MVP, финальные задаются перед запуском.
 */
export interface Plan {
  id: PlanId;
  name: string;
  /** ₽ за пользователя в месяц при оплате за год; null — бесплатно */
  priceYearly: number | null;
  priceMonthly: number | null;
  description: string;
  cta: string;
  highlighted?: boolean;
  limits: { users: string; deals: string; automations: string; ai: string };
  features: string[];
}

/** Максимальная экономия при оплате за год, в процентах (округление вниз) */
export function maxYearlyDiscount(plans: Plan[] = PLANS): number {
  const discounts = plans
    .filter((p) => p.priceMonthly && p.priceYearly)
    .map((p) => Math.floor((1 - p.priceYearly! / p.priceMonthly!) * 100));
  return discounts.length ? Math.max(...discounts) : 0;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceYearly: null,
    priceMonthly: null,
    description: "Для первых продаж и небольшой команды",
    cta: "Начать бесплатно",
    limits: { users: "до 3", deals: "до 300 открытых", automations: "3 активные", ai: "20 запросов в месяц" },
    features: ["Сделки, лиды, клиенты и задачи", "Канбан и таблицы", "Базовая аналитика", "Мобильная версия"],
  },
  {
    id: "pro",
    name: "Pro",
    priceYearly: 690,
    priceMonthly: 890,
    description: "Для отдела продаж, который растёт",
    cta: "Попробовать 14 дней",
    highlighted: true,
    limits: { users: "без ограничений", deals: "без ограничений", automations: "без ограничений", ai: "500 запросов в месяц" },
    features: [
      "Всё из Free",
      "Конструктор автоматизаций",
      "Полная аналитика и отчёты по менеджерам",
      "AI-ассистент без доплат за токены",
      "Интеграции: Telegram, WhatsApp, MAX, сайт",
      "Роли и права доступа",
    ],
  },
  {
    id: "business",
    name: "Business",
    priceYearly: 1290,
    priceMonthly: 1590,
    description: "Для компаний с несколькими отделами",
    cta: "Связаться с нами",
    limits: { users: "без ограничений", deals: "без ограничений", automations: "без ограничений", ai: "без ограничений" },
    features: [
      "Всё из Pro",
      "Несколько воронок и рабочих пространств",
      "API и вебхуки",
      "Журнал действий и экспорт",
      "Персональный менеджер и SLA",
    ],
  },
];
