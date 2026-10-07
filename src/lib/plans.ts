/**
 * План продаж против факта за календарный месяц.
 * Факт — сумма сделок, закрытых успешно в этом месяце. Темп — где менеджер
 * должен быть сегодня, если идти к плану равномерно.
 */
import type { Deal, ID, Member, SalesPlan } from "@/types/crm";
import { addMonths, monthKey, monthStart } from "@/lib/time";

export interface PlanRow {
  member: Member;
  plan: number;
  fact: number;
  /** доля выполнения, может быть больше 1 */
  share: number;
  /** прогноз на конец месяца при текущем темпе */
  projected: number;
}

export interface PlanSummary {
  month: string;
  /** доля прошедшего месяца, 0…1 */
  elapsed: number;
  daysLeft: number;
  rows: PlanRow[];
  plan: number;
  fact: number;
  share: number;
  projected: number;
}

export function monthBounds(month: string) {
  const start = monthStart(month);
  return { start, end: addMonths(start, 1) };
}

export function wonInMonth(deals: Deal[], month: string) {
  const { start, end } = monthBounds(month);
  const byMember = new Map<ID, number>();
  for (const d of deals) {
    if (d.stage !== "won" || !d.closedAt) continue;
    const at = Date.parse(d.closedAt);
    if (at < start || at >= end) continue;
    byMember.set(d.ownerId, (byMember.get(d.ownerId) ?? 0) + d.amount);
  }
  return byMember;
}

export function planSummary({ plans, deals, members, now, month = monthKey(now) }: { plans: SalesPlan[]; deals: Deal[]; members: Member[]; now: number; month?: string }): PlanSummary {
  const { start, end } = monthBounds(month);
  const elapsed = Math.min(1, Math.max(0, (now - start) / (end - start)));
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86_400_000));
  const facts = wonInMonth(deals, month);
  const planByMember = new Map(plans.filter((p) => p.month === month).map((p) => [p.memberId, p.amount]));

  const rows: PlanRow[] = members
    .filter((m) => planByMember.has(m.id))
    .map((member) => {
      const plan = planByMember.get(member.id) ?? 0;
      const fact = facts.get(member.id) ?? 0;
      return { member, plan, fact, share: plan ? fact / plan : 0, projected: elapsed > 0.05 ? fact / elapsed : fact };
    })
    .sort((a, b) => b.share - a.share);

  const plan = rows.reduce((acc, r) => acc + r.plan, 0);
  const fact = rows.reduce((acc, r) => acc + r.fact, 0);
  return { month, elapsed, daysLeft, rows, plan, fact, share: plan ? fact / plan : 0, projected: elapsed > 0.05 ? fact / elapsed : fact };
}

/** Насколько менеджер отстаёт или опережает равномерный темп */
export function paceTone(share: number, elapsed: number): "ahead" | "on" | "behind" {
  if (share >= 1 || share >= elapsed + 0.05) return "ahead";
  if (share >= elapsed - 0.1) return "on";
  return "behind";
}

const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const MONTHS_IN = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];

/** «октябрь» и «в октябре» по ключу 2026-10 */
export function monthName(month: string, form: "nominative" | "prepositional" = "nominative") {
  const index = Number(month.split("-")[1]) - 1;
  return (form === "nominative" ? MONTHS : MONTHS_IN)[index] ?? month;
}

export const shiftMonth = (month: string, delta: number) => monthKey(addMonths(monthStart(month), delta));
