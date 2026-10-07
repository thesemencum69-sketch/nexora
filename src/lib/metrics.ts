/**
 * Аналитический слой: все цифры дашборда и аналитики считаются из сущностей,
 * поэтому KPI, графики и таблицы всегда сходятся между собой.
 * Чистые функции — без React, переиспользуются на сервере.
 */
import type { Client, ClientStatus, Deal, DealStageId, ID, Lead, LeadSource, Member, Task } from "@/types/crm";
import {
  DONUT_SOURCES,
  FUNNEL_STEPS,
  INACTIVE_AFTER_DAYS,
  KEY_CLIENT_REVENUE,
  LEAD_RESPONSE_SLA_MIN,
  OPEN_STAGES,
  REACH_CONTRACT,
  SOURCES,
  STAGE_BY_ID,
  STALE_DEAL_DAYS,
} from "./constants";
import { formatDate, formatMonth, formatMonthLong } from "./format";
import { DAY, MINUTE, addDays, addMonths, startOfDay, startOfMonth } from "./time";
import { stageLabel, stageProbability } from "./stages";

const t = (value: string) => Date.parse(value);

/* ───────────── Периоды ───────────── */

export type PeriodKey = "7d" | "30d" | "3m" | "6m" | "1y";

export const PERIODS: { key: PeriodKey; label: string; short: string; compare: string }[] = [
  { key: "7d", label: "7 дней", short: "7 дней", compare: "к прошлым 7 дням" },
  { key: "30d", label: "30 дней", short: "30 дней", compare: "к прошлым 30 дням" },
  { key: "3m", label: "3 месяца", short: "3 мес.", compare: "к прошлым 3 месяцам" },
  { key: "6m", label: "6 месяцев", short: "6 мес.", compare: "к прошлым 6 месяцам" },
  { key: "1y", label: "1 год", short: "Год", compare: "к прошлому году" },
];

export const periodMeta = (key: PeriodKey) => PERIODS.find((p) => p.key === key)!;

/** Как подписать шаг графика: «по дням», «по неделям», «по месяцам» */
export const bucketLabel = (period: PeriodKey) => (period === "1y" ? "по месяцам" : period === "3m" || period === "6m" ? "по неделям" : "по дням");

export interface Bucket {
  start: number;
  end: number;
  label: string;
  title: string;
}

export interface PeriodWindow {
  start: number;
  end: number;
  prevStart: number;
  prevEnd: number;
  buckets: Bucket[];
  prevBuckets: Bucket[];
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export function getPeriodWindow(period: PeriodKey, now: number): PeriodWindow {
  const today = startOfDay(now);
  let buckets: Bucket[];
  let prevBuckets: Bucket[];

  if (period === "7d" || period === "30d") {
    const n = period === "7d" ? 7 : 30;
    const make = (offset: number) =>
      range(n).map((i) => {
        const start = addDays(today, i - n + 1 - offset);
        return { start, end: addDays(start, 1), label: formatDate(start, now), title: formatDate(start, now) };
      });
    buckets = make(0);
    prevBuckets = make(n);
  } else if (period === "3m" || period === "6m") {
    const weeks = period === "3m" ? 13 : 26;
    const make = (offset: number) => {
      const first = addDays(today, -(weeks * 7 - 1) - offset);
      return range(weeks).map((i) => {
        const start = addDays(first, i * 7);
        const end = addDays(start, 7);
        return { start, end, label: formatDate(start, now), title: `${formatDate(start, now)} – ${formatDate(end - 1, now)}` };
      });
    };
    buckets = make(0);
    prevBuckets = make(weeks * 7);
  } else {
    const make = (offset: number) => {
      const first = addMonths(startOfMonth(now), -11 - offset);
      return range(12).map((i) => {
        const start = addMonths(first, i);
        return { start, end: addMonths(start, 1), label: formatMonth(start), title: formatMonthLong(start) };
      });
    };
    buckets = make(0);
    prevBuckets = make(12);
  }

  return {
    start: buckets[0]!.start,
    end: buckets[buckets.length - 1]!.end,
    prevStart: prevBuckets[0]!.start,
    prevEnd: prevBuckets[prevBuckets.length - 1]!.end,
    buckets,
    prevBuckets,
  };
}

/* ───────────── Фильтры ───────────── */

export interface AnalyticsFilters {
  ownerId: ID | "all";
  source: LeadSource | "all";
}

export const NO_FILTERS: AnalyticsFilters = { ownerId: "all", source: "all" };

const dealPasses = (d: Deal, f: AnalyticsFilters) =>
  (f.ownerId === "all" || d.ownerId === f.ownerId) && (f.source === "all" || d.source === f.source);
const leadPasses = (l: Lead, f: AnalyticsFilters) =>
  (f.ownerId === "all" || l.ownerId === f.ownerId) && (f.source === "all" || l.source === f.source);

export interface Dataset {
  deals: Deal[];
  leads: Lead[];
}

export function filterDataset(data: Dataset, f: AnalyticsFilters): Dataset {
  if (f.ownerId === "all" && f.source === "all") return data;
  return { deals: data.deals.filter((d) => dealPasses(d, f)), leads: data.leads.filter((l) => leadPasses(l, f)) };
}

/* ───────────── Базовые выборки ───────────── */

const inRange = (value: number, start: number, end: number) => value >= start && value < end;

export const isOpen = (d: Deal) => !STAGE_BY_ID[d.stage].closed;

export function wonBetween(deals: Deal[], start: number, end: number) {
  return deals.filter((d) => d.stage === "won" && d.closedAt && inRange(t(d.closedAt), start, end));
}

export function lostBetween(deals: Deal[], start: number, end: number) {
  return deals.filter((d) => d.stage === "lost" && d.closedAt && inRange(t(d.closedAt), start, end));
}

export function leadsBetween(leads: Lead[], start: number, end: number) {
  return leads.filter((l) => inRange(t(l.createdAt), start, end));
}

interface WindowStats {
  revenue: number;
  won: number;
  lost: number;
  leads: number;
}

function windowStats(data: Dataset, start: number, end: number): WindowStats {
  let revenue = 0;
  let won = 0;
  let lost = 0;
  for (const d of data.deals) {
    if (!d.closedAt) continue;
    const closed = t(d.closedAt);
    if (!inRange(closed, start, end)) continue;
    if (d.stage === "won") {
      won++;
      revenue += d.amount;
    } else if (d.stage === "lost") lost++;
  }
  let leads = 0;
  for (const l of data.leads) if (inRange(t(l.createdAt), start, end)) leads++;
  return { revenue, won, lost, leads };
}

/* ───────────── KPI ───────────── */

export type KpiId = "revenue" | "deals" | "leads" | "conversion" | "avgCheck";

export interface Kpi {
  id: KpiId;
  label: string;
  value: number;
  previous: number;
  /** относительное изменение (ratio) или разница в долях (points) */
  delta: number | null;
  deltaKind: "ratio" | "points";
  format: "money" | "number" | "percent";
  spark: number[];
  hint: string;
}

const KPI_META: Record<KpiId, Pick<Kpi, "label" | "format" | "deltaKind" | "hint">> = {
  revenue: { label: "Выручка", format: "money", deltaKind: "ratio", hint: "Сумма успешных сделок, закрытых за период." },
  deals: { label: "Сделки", format: "number", deltaKind: "ratio", hint: "Сколько сделок перешло в «Успешно» за период." },
  leads: { label: "Новые лиды", format: "number", deltaKind: "ratio", hint: "Все новые заявки из всех каналов за период." },
  conversion: { label: "Конверсия", format: "percent", deltaKind: "points", hint: "Успешные сделки, делённые на новые лиды за тот же период." },
  avgCheck: { label: "Средний чек", format: "money", deltaKind: "ratio", hint: "Выручка, делённая на количество успешных сделок." },
};

const metricOf = (id: KpiId, s: WindowStats) => {
  switch (id) {
    case "revenue":
      return s.revenue;
    case "deals":
      return s.won;
    case "leads":
      return s.leads;
    case "conversion":
      return s.leads ? s.won / s.leads : 0;
    case "avgCheck":
      return s.won ? s.revenue / s.won : 0;
  }
};

export function computeKpis(data: Dataset, period: PeriodKey, now: number): Kpi[] {
  const w = getPeriodWindow(period, now);
  const current = windowStats(data, w.start, w.end);
  const previous = windowStats(data, w.prevStart, w.prevEnd);
  const length = w.end - w.start;
  const points = 12;
  const rolling = range(points).map((i) => {
    const end = w.end - ((points - 1 - i) * length) / points;
    return windowStats(data, end - length, end);
  });

  return (Object.keys(KPI_META) as KpiId[]).map((id) => {
    const meta = KPI_META[id];
    const value = metricOf(id, current);
    const prev = metricOf(id, previous);
    const delta = meta.deltaKind === "points" ? value - prev : prev ? (value - prev) / prev : null;
    return { id, ...meta, value, previous: prev, delta, spark: rolling.map((s) => metricOf(id, s)) };
  });
}

/* ───────────── Временные ряды ───────────── */

export interface RevenuePoint {
  label: string;
  title: string;
  revenue: number;
  cumulative: number;
  prevRevenue: number;
  prevCumulative: number;
  deals: number;
  prevDeals: number;
}

export function revenueSeries(data: Dataset, period: PeriodKey, now: number): RevenuePoint[] {
  const w = getPeriodWindow(period, now);
  let cumulative = 0;
  let prevCumulative = 0;
  return w.buckets.map((bucket, i) => {
    const prevBucket = w.prevBuckets[i]!;
    const cur = windowStats({ deals: data.deals, leads: [] }, bucket.start, bucket.end);
    const prev = windowStats({ deals: data.deals, leads: [] }, prevBucket.start, prevBucket.end);
    cumulative += cur.revenue;
    prevCumulative += prev.revenue;
    return {
      label: bucket.label,
      title: bucket.title,
      revenue: cur.revenue,
      cumulative,
      prevRevenue: prev.revenue,
      prevCumulative,
      deals: cur.won,
      prevDeals: prev.won,
    };
  });
}

export interface BucketStats {
  label: string;
  title: string;
  revenue: number;
  won: number;
  lost: number;
  leads: number;
  conversion: number;
  avgCheck: number;
  /** Средний чек за скользящее окно не короче 4 недель: без провалов в неделях без оплат */
  rollingAvgCheck: number | null;
  winRate: number;
  /** Те же доли за скользящее окно не короче 4 недель */
  rollingConversion: number | null;
  rollingWinRate: number | null;
}

/** Минимальное окно для скользящего среднего чека */
export const ROLLING_CHECK_WINDOW = 28 * DAY;

export function bucketSeries(data: Dataset, period: PeriodKey, now: number): BucketStats[] {
  return getPeriodWindow(period, now).buckets.map((b) => {
    const s = windowStats(data, b.start, b.end);
    const rollStart = Math.min(b.start, b.end - ROLLING_CHECK_WINDOW);
    const r = rollStart === b.start ? s : windowStats(data, rollStart, b.end);
    return {
      label: b.label,
      title: b.title,
      ...s,
      conversion: s.leads ? s.won / s.leads : 0,
      avgCheck: s.won ? s.revenue / s.won : 0,
      rollingAvgCheck: r.won ? r.revenue / r.won : null,
      winRate: s.won + s.lost ? s.won / (s.won + s.lost) : 0,
      rollingConversion: r.leads ? Math.min(1, r.won / r.leads) : null,
      rollingWinRate: r.won + r.lost ? r.won / (r.won + r.lost) : null,
    };
  });
}

/* ───────────── Воронка ───────────── */

export interface FunnelStepData {
  key: string;
  label: string;
  count: number;
  amount: number;
  /** конверсия из предыдущего шага */
  conversion: number | null;
  /** доля от первого шага */
  share: number;
}

/**
 * Воронка периода. Верх — новые лиды и контакт с ними; дальше — сделки,
 * закрытые за период, и до какого этапа каждая дошла. Шаги вложены друг в друга,
 * а последний совпадает с KPI «Сделки».
 */
export function funnelData(data: Dataset, period: PeriodKey, now: number): FunnelStepData[] {
  const w = getPeriodWindow(period, now);
  const leads = leadsBetween(data.leads, w.start, w.end);
  const contacted = leads.filter((l) => l.status !== "new");
  const closed = [...wonBetween(data.deals, w.start, w.end), ...lostBetween(data.deals, w.start, w.end)];
  const budget = (items: Lead[]) => items.reduce((acc, l) => acc + (l.budget ?? 0), 0);
  const reached = (step: number) => {
    const items = closed.filter((d) => d.stageReached >= step);
    return [items.length, items.reduce((acc, d) => acc + d.amount, 0)] as [number, number];
  };

  const counts: [number, number][] = [
    [leads.length, budget(leads)],
    [contacted.length, budget(contacted)],
    reached(2),
    reached(3),
    reached(4),
    reached(REACH_CONTRACT),
    reached(6),
  ];
  const first = counts[0]![0] || 1;
  return FUNNEL_STEPS.map((step, i) => {
    const [count, sumAmount] = counts[i]!;
    const prev = i > 0 ? counts[i - 1]![0] : null;
    return {
      key: step.key,
      label: step.key === "leads" || step.key === "contract" ? step.label : stageLabel(step.key),
      count,
      amount: sumAmount,
      conversion: prev === null ? null : prev ? Math.min(1, count / prev) : 0,
      share: count / first,
    };
  });
}

/* ───────────── Источники ───────────── */

export interface SourceRow {
  source: LeadSource;
  leads: number;
  share: number;
  won: number;
  revenue: number;
  conversion: number;
  avgResponseMin: number | null;
}

export function sourceBreakdown(data: Dataset, period: PeriodKey, now: number): SourceRow[] {
  const w = getPeriodWindow(period, now);
  const leads = leadsBetween(data.leads, w.start, w.end);
  const won = wonBetween(data.deals, w.start, w.end);
  const total = leads.length || 1;
  return SOURCES.map(({ id }) => {
    const sourceLeads = leads.filter((l) => l.source === id);
    const sourceWon = won.filter((d) => d.source === id);
    const responses = sourceLeads
      .filter((l) => l.firstResponseAt)
      .map((l) => (t(l.firstResponseAt!) - t(l.createdAt)) / MINUTE);
    return {
      source: id,
      leads: sourceLeads.length,
      share: sourceLeads.length / total,
      won: sourceWon.length,
      revenue: sourceWon.reduce((acc, d) => acc + d.amount, 0),
      conversion: sourceLeads.length ? sourceWon.length / sourceLeads.length : 0,
      avgResponseMin: responses.length ? responses.reduce((a, b) => a + b, 0) / responses.length : null,
    };
  });
}

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  share: number;
  color: string;
}

/** Пять основных каналов + «Другое» (VK, рекомендации, прочее) — не больше шести сегментов */
export function sourceDonut(rows: SourceRow[]): DonutSlice[] {
  const total = rows.reduce((acc, r) => acc + r.leads, 0) || 1;
  const main = DONUT_SOURCES.map((id) => {
    const row = rows.find((r) => r.source === id)!;
    const meta = SOURCES.find((s) => s.id === id)!;
    return { key: id, label: meta.label, value: row.leads, share: row.leads / total, color: meta.color };
  });
  const rest = rows.filter((r) => !DONUT_SOURCES.includes(r.source)).reduce((acc, r) => acc + r.leads, 0);
  return [...main, { key: "rest", label: "Другие каналы", value: rest, share: rest / total, color: "var(--chart-muted)" }];
}

/* ───────────── Требует внимания ───────────── */

export interface AttentionData {
  overdueTasks: Task[];
  staleDeals: Deal[];
  unansweredLeads: Lead[];
  overdueCloseDeals: Deal[];
}

export function attention(deals: Deal[], leads: Lead[], tasks: Task[], now: number): AttentionData {
  const open = deals.filter(isOpen);
  return {
    overdueTasks: tasks.filter((x) => x.status === "open" && t(x.dueAt) < now).sort((a, b) => t(a.dueAt) - t(b.dueAt)),
    staleDeals: open
      .filter((d) => now - t(d.lastActivityAt) > STALE_DEAL_DAYS * DAY)
      .sort((a, b) => b.amount - a.amount),
    unansweredLeads: leads
      .filter((l) => l.status === "new" && !l.firstResponseAt && now - t(l.createdAt) > LEAD_RESPONSE_SLA_MIN * MINUTE)
      .sort((a, b) => t(a.createdAt) - t(b.createdAt)),
    overdueCloseDeals: open.filter((d) => t(d.expectedCloseAt) < now).sort((a, b) => b.amount - a.amount),
  };
}

/* ───────────── Команда ───────────── */

export interface MemberPerformance {
  member: Member;
  revenue: number;
  won: number;
  lost: number;
  winRate: number;
  leads: number;
  openDeals: number;
  pipeline: number;
  avgCycleDays: number | null;
  avgResponseMin: number | null;
}

export function teamPerformance(members: Member[], data: Dataset, period: PeriodKey, now: number): MemberPerformance[] {
  const w = getPeriodWindow(period, now);
  return members
    .map((member) => {
      const own = data.deals.filter((d) => d.ownerId === member.id);
      const won = wonBetween(own, w.start, w.end);
      const lost = lostBetween(own, w.start, w.end);
      const open = own.filter(isOpen);
      const leads = leadsBetween(data.leads, w.start, w.end).filter((l) => l.ownerId === member.id);
      const cycles = won.map((d) => (t(d.closedAt!) - t(d.createdAt)) / DAY);
      const responses = leads.filter((l) => l.firstResponseAt).map((l) => (t(l.firstResponseAt!) - t(l.createdAt)) / MINUTE);
      return {
        member,
        revenue: won.reduce((acc, d) => acc + d.amount, 0),
        won: won.length,
        lost: lost.length,
        winRate: won.length + lost.length ? won.length / (won.length + lost.length) : 0,
        leads: leads.length,
        openDeals: open.length,
        pipeline: open.reduce((acc, d) => acc + d.amount, 0),
        avgCycleDays: cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null,
        avgResponseMin: responses.length ? responses.reduce((a, b) => a + b, 0) / responses.length : null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

/* ───────────── Воронка открытых сделок ───────────── */

export interface PipelineStage {
  stage: DealStageId;
  label: string;
  count: number;
  amount: number;
  weighted: number;
}

export function pipelineByStage(deals: Deal[]): PipelineStage[] {
  return OPEN_STAGES.map((stage) => {
    const items = deals.filter((d) => d.stage === stage);
    const amount = items.reduce((acc, d) => acc + d.amount, 0);
    return { stage, label: stageLabel(stage), count: items.length, amount, weighted: amount * stageProbability(stage) };
  });
}

/* ───────────── Клиенты ───────────── */

export interface ClientStats {
  deals: number;
  won: number;
  revenue: number;
  openDeals: number;
  pipeline: number;
}

const EMPTY_STATS: ClientStats = { deals: 0, won: 0, revenue: 0, openDeals: 0, pipeline: 0 };

export function clientStatsMap(deals: Deal[]) {
  const map = new Map<ID, ClientStats>();
  for (const d of deals) {
    const s = map.get(d.clientId) ?? { ...EMPTY_STATS };
    s.deals++;
    if (d.stage === "won") {
      s.won++;
      s.revenue += d.amount;
    } else if (isOpen(d)) {
      s.openDeals++;
      s.pipeline += d.amount;
    }
    map.set(d.clientId, s);
  }
  return map;
}

export const statsFor = (map: Map<ID, ClientStats>, id: ID) => map.get(id) ?? EMPTY_STATS;

export function clientStatus(client: Client, stats: ClientStats, now: number): ClientStatus {
  if (now - t(client.lastActivityAt) > INACTIVE_AFTER_DAYS * DAY) return "inactive";
  if (stats.revenue >= KEY_CLIENT_REVENUE) return "vip";
  if (now - t(client.createdAt) < 30 * DAY) return "new";
  return "active";
}

/* ───────────── LTV ───────────── */

export const LTV_BANDS = [
  { label: "до 100 тыс.", min: 0, max: 100_000 },
  { label: "100–300 тыс.", min: 100_000, max: 300_000 },
  { label: "300–600 тыс.", min: 300_000, max: 600_000 },
  { label: "600 тыс. – 1 млн", min: 600_000, max: 1_000_000 },
  { label: "от 1 млн", min: 1_000_000, max: Infinity },
];

export function ltvDistribution(clients: Client[], statsMap: Map<ID, ClientStats>) {
  const paying = clients.map((c) => statsFor(statsMap, c.id).revenue).filter((v) => v > 0);
  return {
    average: paying.length ? paying.reduce((a, b) => a + b, 0) / paying.length : 0,
    payingClients: paying.length,
    bands: LTV_BANDS.map((band) => ({ label: band.label, count: paying.filter((v) => v >= band.min && v < band.max).length })),
  };
}

export function ltvBySource(clients: Client[], statsMap: Map<ID, ClientStats>) {
  return SOURCES.map((s) => {
    const values = clients
      .filter((c) => c.source === s.id)
      .map((c) => statsFor(statsMap, c.id).revenue)
      .filter((v) => v > 0);
    return { source: s.id, label: s.label, value: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0, clients: values.length };
  }).filter((row) => row.clients > 0);
}

/* ───────────── Скорость ответа ───────────── */

export function responseMinutes(lead: Lead) {
  return lead.firstResponseAt ? (t(lead.firstResponseAt) - t(lead.createdAt)) / MINUTE : null;
}

export function averageResponse(leads: Lead[]) {
  const values = leads.map(responseMinutes).filter((v): v is number => v !== null);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function forecast(deals: Deal[]) {
  return deals.filter(isOpen).reduce((acc, d) => acc + d.amount * stageProbability(d.stage), 0);
}

export const daysSince = (value: string, now: number) => Math.floor((now - t(value)) / DAY);
export const isOverdue = (task: Task, now: number) => task.status === "open" && t(task.dueAt) < now;
export const dueToday = (task: Task, now: number) =>
  task.status === "open" && t(task.dueAt) >= now && startOfDay(task.dueAt) === startOfDay(now);
