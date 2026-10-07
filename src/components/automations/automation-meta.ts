import type { ActionType, Automation, AutomationAction, AutomationCondition, ConditionField, ConditionOperator, Priority, TriggerType } from "@/types/crm";
import { LEAD_STATUSES, PRIORITIES, SOURCE_BY_ID, STAGE_BY_ID } from "@/lib/constants";
import { stageLabel } from "@/lib/stages";
import { describeTrigger } from "@/lib/automation-engine";
import { formatMoney } from "@/lib/format";

export const TRIGGERS: { type: TriggerType; label: string; scheduled?: boolean; subject: "deal" | "lead" | "task" }[] = [
  { type: "lead_created", label: "Пришёл новый лид", subject: "lead" },
  { type: "deal_created", label: "Создана сделка", subject: "deal" },
  { type: "deal_stage_changed", label: "Сделка перешла на этап", subject: "deal" },
  { type: "deal_won", label: "Сделка выиграна", subject: "deal" },
  { type: "deal_idle", label: "Сделка без движения", subject: "deal", scheduled: true },
  { type: "task_overdue", label: "Задача просрочена", subject: "task", scheduled: true },
];

export const FIELDS: { field: ConditionField; label: string; subjects: ("deal" | "lead")[] }[] = [
  { field: "amount", label: "Сумма", subjects: ["deal", "lead"] },
  { field: "source", label: "Источник", subjects: ["deal", "lead"] },
  { field: "priority", label: "Приоритет", subjects: ["deal"] },
  { field: "stage", label: "Этап", subjects: ["deal"] },
  { field: "owner", label: "Ответственный", subjects: ["deal", "lead"] },
];

export const OPERATORS: Record<ConditionOperator, string> = { gt: "больше", lt: "меньше", eq: "равно", neq: "не равно" };

export const operatorsFor = (field: ConditionField): ConditionOperator[] => (field === "amount" ? ["gt", "lt"] : ["eq", "neq"]);

export const ACTIONS: { type: ActionType; label: string; soon?: boolean; subjects: ("deal" | "lead" | "task")[] }[] = [
  { type: "create_task", label: "Создать задачу", subjects: ["deal", "lead", "task"] },
  { type: "assign_owner", label: "Назначить ответственного", subjects: ["deal", "lead"] },
  { type: "notify", label: "Отправить уведомление", subjects: ["deal", "lead", "task"] },
  { type: "set_priority", label: "Изменить приоритет", subjects: ["deal"] },
  { type: "set_lead_status", label: "Изменить статус лида", subjects: ["lead"] },
  { type: "send_telegram", label: "Написать в Telegram", soon: true, subjects: ["deal", "lead", "task"] },
  { type: "webhook", label: "Отправить вебхук", soon: true, subjects: ["deal", "lead", "task"] },
];

export const DUE_OPTIONS = [
  { value: "0.25", label: "через 15 минут" },
  { value: "1", label: "через час" },
  { value: "4", label: "через 4 часа" },
  { value: "24", label: "через день" },
  { value: "48", label: "через 2 дня" },
  { value: "168", label: "через неделю" },
];

export const RECIPIENTS = [
  { value: "owner", label: "ответственному" },
  { value: "admin", label: "руководителю" },
  { value: "team", label: "всей команде" },
];

export function defaultParams(type: ActionType): Record<string, string> {
  switch (type) {
    case "create_task":
      return { title: "Связаться с клиентом", dueInHours: "24", assignee: "owner", priority: "medium" };
    case "assign_owner":
      return { strategy: "round_robin" };
    case "notify":
      return { to: "owner", message: "Требует внимания" };
    case "set_priority":
      return { priority: "high" };
    case "set_lead_status":
      return { status: "contacted" };
    case "send_telegram":
      return { chat: "@sales", message: "" };
    case "webhook":
      return { url: "https://" };
  }
}

export function describeCondition(c: AutomationCondition, memberName: (id: string) => string) {
  const field = FIELDS.find((f) => f.field === c.field)?.label ?? c.field;
  let value = c.value;
  if (c.field === "amount") value = formatMoney(Number(c.value || 0));
  if (c.field === "source") value = SOURCE_BY_ID[c.value as keyof typeof SOURCE_BY_ID]?.label ?? c.value;
  if (c.field === "priority") value = PRIORITIES[c.value as Priority]?.label.toLowerCase() ?? c.value;
  if (c.field === "stage") value = c.value in STAGE_BY_ID ? stageLabel(c.value as keyof typeof STAGE_BY_ID) : c.value;
  if (c.field === "owner") value = memberName(c.value);
  if (c.operator === "gt") return `${field} больше ${value}`;
  if (c.operator === "lt") return `${field} меньше ${value}`;
  return `${field} ${c.operator === "neq" ? "не " : ""}${value}`;
}

export function describeAction(a: AutomationAction, memberName: (id: string) => string) {
  const p = a.params;
  /** Роль получателя в нужном падеже; для конкретного сотрудника — null, его имя пишем отдельно */
  const role = (key: string | undefined, grammaticalCase: "dative" | "accusative") => {
    const forms: Record<string, [string, string]> = {
      owner: ["ответственному", "ответственного"],
      admin: ["руководителю", "руководителя"],
      team: ["всей команде", "всю команду"],
    };
    const pair = forms[key || "owner"];
    return pair ? pair[grammaticalCase === "dative" ? 0 : 1] : null;
  };
  switch (a.type) {
    case "create_task": {
      const to = role(p.assignee, "dative") ?? `(${memberName(p.assignee!)})`;
      return `Задача «${p.title || "без названия"}» ${to}, ${DUE_OPTIONS.find((d) => d.value === p.dueInHours)?.label ?? "через день"}`;
    }
    case "assign_owner":
      return p.strategy === "round_robin" || !p.strategy ? "Назначить менеджера по очереди" : `Назначить: ${memberName(p.strategy)}`;
    case "notify": {
      const to = role(p.to, "accusative");
      return to ? `Уведомить ${to}` : `Уведомить: ${memberName(p.to!)}`;
    }
    case "set_priority":
      return `Приоритет: ${PRIORITIES[(p.priority as Priority) ?? "high"].label.toLowerCase()}`;
    case "set_lead_status":
      return `Статус лида: ${LEAD_STATUSES[p.status as keyof typeof LEAD_STATUSES]?.label.toLowerCase() ?? p.status}`;
    case "send_telegram":
      return `Сообщение в Telegram ${p.chat ?? ""}`;
    case "webhook":
      return "Вебхук во внешнюю систему";
  }
}

export function sentence(automation: Pick<Automation, "trigger" | "conditions" | "actions">, memberName: (id: string) => string) {
  const when = describeTrigger(automation).toLowerCase();
  const ifs = automation.conditions.length ? `, если ${automation.conditions.map((c) => describeCondition(c, memberName).toLowerCase()).join(" и ")}` : "";
  const then = automation.actions.map((a) => describeAction(a, memberName).replace(/^./, (ch) => ch.toLowerCase())).join("; ");
  return `Когда ${when}${ifs} — ${then || "ничего не делать"}.`;
}
