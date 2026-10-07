import type { Automation, ID } from "@/types/crm";
import { DAY, HOUR, iso } from "@/lib/time";

/** Шаблоны автоматизаций: используются и в демо-данных, и в галерее конструктора */
export const AUTOMATION_TEMPLATES: Omit<Automation, "id" | "runs" | "lastRunAt" | "createdAt" | "createdBy" | "active">[] = [
  {
    name: "Новый лид → ответственный и задача",
    description: "Распределяет заявки по очереди между менеджерами и ставит задачу ответить за 15 минут.",
    trigger: { type: "lead_created" },
    conditions: [],
    actions: [
      { id: "a1", type: "assign_owner", params: { strategy: "round_robin" } },
      { id: "a2", type: "notify", params: { to: "owner", message: "Новая заявка — ответьте в течение 15 минут" } },
      { id: "a3", type: "create_task", params: { title: "Ответить на заявку", dueInHours: "0.25", assignee: "owner", priority: "high" } },
    ],
  },
  {
    name: "Крупная сделка → контроль руководителя",
    description: "Если сумма новой сделки больше 300 000 ₽, руководитель продаж получает задачу проверить её.",
    trigger: { type: "deal_created" },
    conditions: [{ id: "c1", field: "amount", operator: "gt", value: "300000" }],
    actions: [
      { id: "a1", type: "set_priority", params: { priority: "high" } },
      { id: "a2", type: "create_task", params: { title: "Проверить крупную сделку", dueInHours: "24", assignee: "admin", priority: "high" } },
      { id: "a3", type: "notify", params: { to: "admin", message: "Создана крупная сделка" } },
    ],
  },
  {
    name: "КП отправлено → напоминание через 2 дня",
    description: "Когда сделка переходит на этап «Предложение», менеджер получает задачу узнать решение клиента.",
    trigger: { type: "deal_stage_changed", stage: "proposal" },
    conditions: [],
    actions: [
      { id: "a1", type: "create_task", params: { title: "Узнать решение по коммерческому предложению", dueInHours: "48", assignee: "owner", priority: "medium" } },
    ],
  },
  {
    name: "Сделка выиграна → запуск проекта",
    description: "После оплаты ставит задачу на kick-off встречу и уведомляет команду.",
    trigger: { type: "deal_won" },
    conditions: [],
    actions: [
      { id: "a1", type: "create_task", params: { title: "Провести kick-off встречу", dueInHours: "24", assignee: "owner", priority: "medium" } },
      { id: "a2", type: "notify", params: { to: "team", message: "Сделка выиграна — запускаем проект" } },
    ],
  },
  {
    name: "Рекомендация → высокий приоритет",
    description: "Лиды по рекомендации конвертируются лучше всего — сразу поднимаем их в приоритет.",
    trigger: { type: "lead_created" },
    conditions: [{ id: "c1", field: "source", operator: "eq", value: "referral" }],
    actions: [
      { id: "a1", type: "notify", params: { to: "admin", message: "Пришёл лид по рекомендации" } },
      { id: "a2", type: "set_lead_status", params: { status: "qualified" } },
    ],
  },
  {
    name: "Сделка без движения 7 дней",
    description: "Проверяется каждый час: если по сделке нет активности неделю, менеджер получает задачу её оживить.",
    trigger: { type: "deal_idle", days: 7 },
    conditions: [],
    actions: [
      { id: "a1", type: "create_task", params: { title: "Вернуть сделку в работу", dueInHours: "4", assignee: "owner", priority: "high" } },
      { id: "a2", type: "notify", params: { to: "owner", message: "Сделка без активности 7 дней" } },
    ],
  },
];

const DEMO_STATS: [boolean, number, number][] = [
  [true, 418, 0.4],
  [true, 23, 30],
  [true, 96, 5],
  [true, 64, 26],
  [false, 12, 240],
  [true, 37, 2],
];

export function demoAutomations(now: number, createdBy: ID): Automation[] {
  return AUTOMATION_TEMPLATES.map((template, index) => {
    const [active, runs, hoursAgo] = DEMO_STATS[index]!;
    return {
      ...template,
      id: `auto_${index + 1}`,
      active,
      runs,
      lastRunAt: iso(now - hoursAgo * HOUR),
      createdBy,
      createdAt: iso(now - (240 - index * 30) * DAY),
    };
  });
}
