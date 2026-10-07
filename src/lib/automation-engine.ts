/**
 * Движок автоматизаций: КОГДА (триггер) → ЕСЛИ (условия) → ТО (действия).
 * Чистая функция: получает событие и текущие данные, возвращает эффекты.
 * В демо-режиме вызывается из клиентского стора, в продакшене — из серверных
 * action-ов и фоновой очереди (для триггеров по времени).
 */
import type {
  AppNotification,
  Automation,
  AutomationCondition,
  CrmData,
  Deal,
  DealStageId,
  ID,
  Lead,
  LeadStatus,
  Priority,
  Task,
} from "@/types/crm";
import { SOURCE_BY_ID } from "./constants";
import { stageLabel } from "./stages";
import { HOUR, iso } from "./time";
import { uid } from "./utils";

export type AutomationEvent =
  | { type: "deal_created"; deal: Deal }
  | { type: "deal_stage_changed"; deal: Deal; from: DealStageId }
  | { type: "deal_won"; deal: Deal }
  | { type: "lead_created"; lead: Lead };

export interface AutomationEffects {
  fired: Automation[];
  tasks: Task[];
  notifications: AppNotification[];
  dealPatch: Partial<Pick<Deal, "ownerId" | "priority">>;
  leadPatch: Partial<Pick<Lead, "ownerId" | "status">>;
}

type Subject = { kind: "deal"; deal: Deal } | { kind: "lead"; lead: Lead };

const subjectOf = (event: AutomationEvent): Subject =>
  event.type === "lead_created" ? { kind: "lead", lead: event.lead } : { kind: "deal", deal: event.deal };

function fieldValue(subject: Subject, field: AutomationCondition["field"]): string | number | null {
  if (subject.kind === "lead") {
    const { lead } = subject;
    if (field === "amount") return lead.budget ?? 0;
    if (field === "source") return lead.source;
    if (field === "owner") return lead.ownerId;
    return null;
  }
  const { deal } = subject;
  switch (field) {
    case "amount":
      return deal.amount;
    case "source":
      return deal.source;
    case "priority":
      return deal.priority;
    case "stage":
      return deal.stage;
    case "owner":
      return deal.ownerId;
  }
}

export function conditionMatches(subject: Subject, condition: AutomationCondition) {
  const actual = fieldValue(subject, condition.field);
  if (actual === null) return false;
  switch (condition.operator) {
    case "gt":
      return Number(actual) > Number(condition.value);
    case "lt":
      return Number(actual) < Number(condition.value);
    case "eq":
      return String(actual) === condition.value;
    case "neq":
      return String(actual) !== condition.value;
  }
}

function triggerMatches(automation: Automation, event: AutomationEvent) {
  if (!automation.active || automation.trigger.type !== event.type) return false;
  if (event.type === "deal_stage_changed" && automation.trigger.stage) return event.deal.stage === automation.trigger.stage;
  return true;
}

/** Следующий ответственный по очереди: у кого меньше открытых лидов */
function roundRobin(data: CrmData): ID {
  const sellers = data.members.filter((m) => m.role === "manager" || m.role === "admin");
  const load = new Map(sellers.map((m) => [m.id, 0]));
  for (const lead of data.leads) {
    if (lead.ownerId && load.has(lead.ownerId) && (lead.status === "new" || lead.status === "contacted")) {
      load.set(lead.ownerId, load.get(lead.ownerId)! + 1);
    }
  }
  return [...load.entries()].sort((a, b) => a[1] - b[1])[0]?.[0] ?? data.currentUserId;
}

export function runAutomations(event: AutomationEvent, data: CrmData, now = Date.now()): AutomationEffects {
  const effects: AutomationEffects = { fired: [], tasks: [], notifications: [], dealPatch: {}, leadPatch: {} };
  const subject = subjectOf(event);
  const admin = data.members.find((m) => m.role === "admin")?.id ?? data.currentUserId;

  for (const automation of data.automations) {
    if (!triggerMatches(automation, event)) continue;
    if (!automation.conditions.every((c) => conditionMatches(subject, c))) continue;
    effects.fired.push(automation);

    const owner = () =>
      subject.kind === "deal"
        ? (effects.dealPatch.ownerId ?? subject.deal.ownerId)
        : (effects.leadPatch.ownerId ?? subject.lead.ownerId ?? data.currentUserId);
    const resolve = (who: string | undefined): ID => (who === "admin" ? admin : who === "owner" || !who ? owner() : who);
    const label =
      subject.kind === "deal"
        ? `«${subject.deal.title}»`
        : `${subject.lead.name}, заявка ${SOURCE_BY_ID[subject.lead.source].from}`;

    for (const action of automation.actions) {
      const p = action.params;
      switch (action.type) {
        case "assign_owner": {
          const next = p.strategy === "round_robin" || !p.strategy ? roundRobin(data) : p.strategy;
          if (subject.kind === "deal") effects.dealPatch.ownerId = next;
          else effects.leadPatch.ownerId = next;
          break;
        }
        case "set_priority":
          if (subject.kind === "deal") effects.dealPatch.priority = (p.priority as Priority) ?? "high";
          break;
        case "set_lead_status":
          if (subject.kind === "lead") effects.leadPatch.status = (p.status as LeadStatus) ?? "contacted";
          break;
        case "create_task":
          effects.tasks.push({
            id: uid("task"),
            title: p.title || "Задача по автоматизации",
            description: `Создано автоматизацией «${automation.name}» для ${label}.`,
            assigneeId: resolve(p.assignee),
            priority: (p.priority as Priority) ?? "medium",
            status: "open",
            dueAt: iso(now + Number(p.dueInHours || 24) * HOUR),
            completedAt: null,
            dealId: subject.kind === "deal" ? subject.deal.id : null,
            clientId: subject.kind === "deal" ? subject.deal.clientId : null,
            leadId: subject.kind === "lead" ? subject.lead.id : null,
            createdBy: null,
            createdAt: iso(now),
          });
          break;
        case "notify":
          effects.notifications.push({
            id: uid("ntf"),
            type: "automation",
            title: automation.name,
            body: `${p.message || "Сработала автоматизация"}: ${label}`,
            href: subject.kind === "deal" ? `/deals?deal=${subject.deal.id}` : "/leads",
            actorId: null,
            read: false,
            createdAt: iso(now),
          });
          break;
        case "send_telegram":
        case "webhook":
          // Внешние каналы подключаются на этапе backend-интеграций
          break;
      }
    }
  }
  return effects;
}

export function describeTrigger(automation: Pick<Automation, "trigger">) {
  const { trigger } = automation;
  switch (trigger.type) {
    case "deal_created":
      return "Создана сделка";
    case "deal_stage_changed":
      return trigger.stage ? `Сделка перешла в «${stageLabel(trigger.stage)}»` : "Сделка сменила этап";
    case "deal_won":
      return "Сделка выиграна";
    case "lead_created":
      return "Пришёл новый лид";
    case "task_overdue":
      return "Задача просрочена";
    case "deal_idle":
      return `Нет активности ${trigger.days ?? 7} дней`;
  }
}
