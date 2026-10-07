"use client";

import * as React from "react";
import type { Client, Deal, Member } from "@/types/crm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { BarList } from "@/components/charts/bar-list";
import { ChartLegend } from "@/components/charts/chart-tooltip";
import { DonutChart } from "@/components/charts/donut-chart";
import { FunnelChart } from "@/components/charts/funnel-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { Delta } from "@/components/common/delta";
import { SourceLabel, StageDot } from "@/components/common/entity-meta";
import { StatTile } from "@/components/common/stat-tile";
import { UserAvatar } from "@/components/common/user-avatar";
import { LEAD_STATUSES } from "@/lib/constants";
import { stageLabel } from "@/lib/stages";
import { formatCount, formatDuration, formatMoney, formatMoneyCompact, formatNumber, formatPercent } from "@/lib/format";
import {
  bucketLabel,
  bucketSeries,
  clientStatsMap,
  computeKpis,
  funnelData,
  getPeriodWindow,
  leadsBetween,
  lostBetween,
  ltvBySource,
  ltvDistribution,
  pipelineByStage,
  revenueSeries,
  sourceBreakdown,
  sourceDonut,
  teamPerformance,
  wonBetween,
  type Dataset,
  type PeriodKey,
} from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { SalesPlanCard } from "@/components/plans/sales-plan";

export interface SectionProps {
  data: Dataset;
  period: PeriodKey;
  now: number;
  members: Member[];
  clients: Client[];
  status: "all" | "won" | "lost" | "open";
}

function ChartCard({ title, description, children, className, legend }: { title: string; description?: string; children: React.ReactNode; className?: string; legend?: React.ReactNode }) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {legend && <div className="ml-auto pt-1">{legend}</div>}
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/* ───────────── Продажи ───────────── */

export function SalesSection({ data, period, now, status }: SectionProps) {
  const w = getPeriodWindow(period, now);
  const won = wonBetween(data.deals, w.start, w.end);
  const lost = lostBetween(data.deals, w.start, w.end);
  const prevWon = wonBetween(data.deals, w.prevStart, w.prevEnd);
  const prevLost = lostBetween(data.deals, w.prevStart, w.prevEnd);
  const winRate = won.length + lost.length ? won.length / (won.length + lost.length) : 0;
  const prevWinRate = prevWon.length + prevLost.length ? prevWon.length / (prevWon.length + prevLost.length) : 0;
  const cycle = avg(won.map((d) => (Date.parse(d.closedAt!) - Date.parse(d.createdAt)) / 86_400_000));
  const kpis = computeKpis(data, period, now);
  const avgCheck = kpis.find((k) => k.id === "avgCheck")!;
  const buckets = bucketSeries(data, period, now);
  const pipeline = pipelineByStage(data.deals);
  const showWon = status !== "lost";
  const showLost = status !== "won";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Выиграно сделок" value={formatNumber(won.length)} hint={<Delta value={prevWon.length ? (won.length - prevWon.length) / prevWon.length : null} />} />
        <StatTile label="Доля выигранных" value={formatPercent(winRate)} hint={<Delta value={winRate - prevWinRate} kind="points" />} />
        <StatTile label="Средний цикл сделки" value={cycle !== null ? `${Math.round(cycle)} дн.` : "—"} hint="От создания до оплаты" />
        <StatTile label="Средний чек" value={formatMoney(avgCheck.value)} hint={<Delta value={avgCheck.delta} />} />
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        <ChartCard
          title="Сделки по времени"
          description="Выигранные и проигранные"
          className="xl:col-span-3"
          legend={
            <ChartLegend
              items={[
                ...(showWon ? [{ label: "Выиграны", color: "var(--primary)", shape: "bar" as const }] : []),
                ...(showLost ? [{ label: "Проиграны", color: "var(--chart-muted)", shape: "bar" as const }] : []),
              ]}
            />
          }
        >
          <TrendChart
            data={buckets.map((b) => ({ label: b.label, title: b.title, won: b.won, lost: b.lost }))}
            height={260}
            format={(v) => formatNumber(v)}
            series={[
              ...(showWon ? [{ key: "won", label: "Выиграны", type: "bar" as const, color: "var(--primary)" }] : []),
              ...(showLost ? [{ key: "lost", label: "Проиграны", type: "bar" as const, color: "var(--chart-muted)" }] : []),
            ]}
          />
        </ChartCard>
        <ChartCard title="Открытая воронка" description="Сумма сделок на каждом этапе" className="xl:col-span-2">
          <BarList
            items={pipeline.map((p) => ({
              key: p.stage,
              label: (
                <span className="flex items-center gap-2">
                  <StageDot stage={p.stage} />
                  {p.label}
                </span>
              ),
              value: p.amount,
              display: formatMoneyCompact(p.amount),
              secondary: `${p.count} шт.`,
            }))}
          />
          <p className="mt-4 border-t pt-3 text-[13px] text-muted-foreground">
            Взвешенный прогноз с учётом вероятности этапов:{" "}
            <span className="font-semibold text-foreground">{formatMoney(pipeline.reduce((a, p) => a + p.weighted, 0))}</span>
          </p>
        </ChartCard>
      </div>
      <ChartCard
        title="Средний чек"
        description={
          period === "1y"
            ? "Выручка, делённая на число выигранных сделок, по месяцам"
            : "Выручка, делённая на число выигранных сделок, за последние 4 недели на каждую дату"
        }
      >
        <TrendChart
          data={buckets.map((b) => ({ label: b.label, title: b.title, avg: b.rollingAvgCheck === null ? null : Math.round(b.rollingAvgCheck) }))}
          height={220}
          format={formatMoney}
          axisFormat={(v) => formatMoneyCompact(v, false)}
          series={[{ key: "avg", label: "Средний чек", type: "line", color: "var(--primary)" }]}
        />
      </ChartCard>
    </div>
  );
}

/* ───────────── Выручка ───────────── */

export function RevenueSection({ data, period, now, clients }: SectionProps) {
  const [mode, setMode] = React.useState<"cumulative" | "period">("cumulative");
  const series = revenueSeries(data, period, now);
  const sources = sourceBreakdown(data, period, now).filter((s) => s.revenue > 0).sort((a, b) => b.revenue - a.revenue);
  const stats = clientStatsMap(data.deals);
  const ltv = ltvDistribution(clients, stats);
  const ltvSources = ltvBySource(clients, stats).sort((a, b) => b.value - a.value);
  const total = series.reduce((a, p) => a + p.revenue, 0);
  const prev = series.reduce((a, p) => a + p.prevRevenue, 0);
  const step = bucketLabel(period);

  return (
    <div className="space-y-4">
      <ChartCard
        title="Выручка по времени"
        description={`${formatMoney(total)} за период`}
        legend={
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <ChartLegend
              items={[
                { label: "Этот период", color: "var(--primary)" },
                { label: "Прошлый период", color: "var(--muted-foreground)", shape: "dashed" },
              ]}
            />
            <Segmented
              size="sm"
              value={mode}
              onValueChange={setMode}
              options={[
                { value: "cumulative", label: "Нарастающим итогом" },
                { value: "period", label: step.replace("по ", "По ") },
              ]}
              aria-label="Вид графика"
            />
          </div>
        }
      >
        <div className="mb-3 flex items-center gap-2 text-[13px]">
          <Delta value={prev ? (total - prev) / prev : null} />
          <span className="text-muted-foreground">к прошлому периоду ({formatMoney(prev)})</span>
        </div>
        <TrendChart
          data={series.map((p) => ({
            label: p.label,
            title: p.title,
            current: mode === "cumulative" ? p.cumulative : p.revenue,
            previous: mode === "cumulative" ? p.prevCumulative : p.prevRevenue,
          }))}
          height={280}
          format={formatMoney}
          axisFormat={(v) => formatMoneyCompact(v, false)}
          series={[
            { key: "previous", label: "Прошлый период", type: "line", color: "var(--muted-foreground)", dashed: true, muted: true },
            { key: "current", label: "Этот период", type: "area", color: "var(--primary)" },
          ]}
        />
      </ChartCard>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Выручка по источникам" description="Откуда приходят деньги, а не только заявки">
          <BarList
            items={sources.map((s) => ({
              key: s.source,
              label: <SourceLabel source={s.source} />,
              value: s.revenue,
              display: formatMoneyCompact(s.revenue),
              secondary: formatCount(s.won, ["сделка", "сделки", "сделок"]),
            }))}
          />
        </ChartCard>
        <ChartCard title="Пожизненная ценность клиента" description="Сколько приносит клиент за всё время работы">
          <div className="mb-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[28px] font-semibold tracking-[-0.03em]">{formatMoney(ltv.average)}</span>
            <span className="text-[13px] text-muted-foreground">в среднем у {formatCount(ltv.payingClients, ["платящего клиента", "платящих клиентов", "платящих клиентов"])}</span>
          </div>
          <h3 className="mb-3 text-xs font-medium text-muted-foreground">Сколько клиентов в каждом диапазоне</h3>
          <BarList
            items={ltv.bands.map((b) => ({
              key: b.label,
              label: b.label,
              value: b.count,
              display: formatNumber(b.count),
              secondary: ltv.payingClients ? formatPercent(b.count / ltv.payingClients) : undefined,
            }))}
          />
        </ChartCard>
        <ChartCard title="LTV по источникам" description="Средняя выручка с клиента в зависимости от канала" className="lg:col-span-2 xl:col-span-1">
          <BarList
            items={ltvSources.map((s) => ({
              key: s.source,
              label: <SourceLabel source={s.source} />,
              value: s.value,
              display: formatMoneyCompact(s.value),
              secondary: formatCount(s.clients, ["клиент", "клиента", "клиентов"]),
            }))}
          />
        </ChartCard>
      </div>
    </div>
  );
}

/* ───────────── Лиды ───────────── */

export function LeadsSection({ data, period, now }: SectionProps) {
  const buckets = bucketSeries(data, period, now);
  const rows = sourceBreakdown(data, period, now);
  const w = getPeriodWindow(period, now);
  const leads = leadsBetween(data.leads, w.start, w.end);
  const total = leads.length;
  const byStatus = (Object.keys(LEAD_STATUSES) as (keyof typeof LEAD_STATUSES)[]).map((status) => ({
    status,
    count: leads.filter((l) => l.status === status).length,
  }));

  return (
    <div className="space-y-4">
      <ChartCard title="Новые лиды" description={`${formatNumber(total)} за период`}>
        <TrendChart
          data={buckets.map((b) => ({ label: b.label, title: b.title, leads: b.leads }))}
          height={240}
          format={(v) => formatCount(v, ["лид", "лида", "лидов"])}
          axisFormat={(v) => formatNumber(v)}
          series={[{ key: "leads", label: "Лидов", type: "bar", color: "var(--primary)" }]}
        />
      </ChartCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Источники" description="Пять основных каналов и остальные">
          <DonutChart data={sourceDonut(rows)} centerValue={formatNumber(total)} centerLabel="лидов" />
        </ChartCard>
        <ChartCard title="Где сейчас лиды этого периода" description="Статусы заявок">
          <BarList
            items={byStatus.map((s) => ({
              key: s.status,
              label: LEAD_STATUSES[s.status].label,
              value: s.count,
              display: formatNumber(s.count),
              secondary: total ? formatPercent(s.count / total) : undefined,
            }))}
          />
        </ChartCard>
      </div>
    </div>
  );
}

/* ───────────── Сотрудники ───────────── */

export function EmployeesSection({ data, period, now, members }: SectionProps) {
  const rows = teamPerformance(members, data, period, now).filter((r) => r.leads || r.won || r.openDeals || r.lost);
  return (
    <div className="space-y-4">
      <SalesPlanCard now={now} />
      <ChartCard title="Продажи по сотрудникам" description="Выручка от выигранных сделок за период">
        <BarList
          items={rows.map((r) => ({
            key: r.member.id,
            label: (
              <span className="flex items-center gap-2">
                <UserAvatar name={r.member.name} hue={r.member.hue} size="xs" />
                {r.member.name}
              </span>
            ),
            value: r.revenue,
            display: formatMoney(r.revenue),
            secondary: formatCount(r.won, ["сделка", "сделки", "сделок"]),
          }))}
        />
      </ChartCard>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="h-10 pl-5 font-medium">Сотрудник</th>
                <th className="h-10 px-3 text-right font-medium">Выручка</th>
                <th className="h-10 px-3 text-right font-medium">Выиграно</th>
                <th className="h-10 px-3 text-right font-medium">Доля выигранных</th>
                <th className="h-10 px-3 text-right font-medium">Цикл сделки</th>
                <th className="h-10 px-3 text-right font-medium">Ответ лиду</th>
                <th className="h-10 pr-5 text-right font-medium">В работе</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.member.id} className="border-b last:border-0">
                  <td className="py-3 pl-5">
                    <span className="flex items-center gap-2.5">
                      <UserAvatar name={r.member.name} hue={r.member.hue} size="sm" />
                      <span>
                        <span className="block font-medium">{r.member.name}</span>
                        <span className="block text-xs text-muted-foreground">{r.member.position}</span>
                      </span>
                    </span>
                  </td>
                  <td className="tabular px-3 py-3 text-right font-semibold">{formatMoney(r.revenue)}</td>
                  <td className="tabular px-3 py-3 text-right">{r.won}</td>
                  <td className="tabular px-3 py-3 text-right">{r.won + r.lost ? formatPercent(r.winRate) : "—"}</td>
                  <td className="tabular px-3 py-3 text-right">{r.avgCycleDays !== null ? `${Math.round(r.avgCycleDays)} дн.` : "—"}</td>
                  <td className="tabular px-3 py-3 text-right">{r.avgResponseMin !== null ? formatDuration(r.avgResponseMin) : "—"}</td>
                  <td className="tabular py-3 pr-5 text-right">{formatMoneyCompact(r.pipeline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ───────────── Источники ───────────── */

export function SourcesSection({ data, period, now }: SectionProps) {
  const rows = sourceBreakdown(data, period, now).sort((a, b) => b.leads - a.leads);
  const maxConv = Math.max(...rows.map((r) => r.conversion));
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Эффективность каналов</CardTitle>
            <CardDescription>Сколько заявок даёт канал и сколько из них превращается в деньги</CardDescription>
          </div>
        </CardHeader>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="h-10 pl-5 font-medium">Источник</th>
                <th className="h-10 px-3 text-right font-medium">Лиды</th>
                <th className="h-10 px-3 text-right font-medium">Доля</th>
                <th className="h-10 px-3 text-right font-medium">Продажи</th>
                <th className="h-10 px-3 text-right font-medium">Конверсия</th>
                <th className="h-10 px-3 text-right font-medium">Выручка</th>
                <th className="h-10 pr-5 text-right font-medium">Ответ лиду</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.source} className="border-b last:border-0">
                  <td className="py-3 pl-5">
                    <SourceLabel source={r.source} />
                  </td>
                  <td className="tabular px-3 py-3 text-right">{r.leads}</td>
                  <td className="tabular px-3 py-3 text-right text-muted-foreground">{formatPercent(r.share)}</td>
                  <td className="tabular px-3 py-3 text-right">{r.won}</td>
                  <td className={cn("tabular px-3 py-3 text-right", r.conversion === maxConv && r.conversion > 0 && "font-semibold text-success-text")}>
                    {r.leads ? formatPercent(r.conversion) : "—"}
                  </td>
                  <td className="tabular px-3 py-3 text-right font-semibold">{formatMoney(r.revenue)}</td>
                  <td className="tabular py-3 pr-5 text-right text-muted-foreground">{r.avgResponseMin !== null ? formatDuration(r.avgResponseMin) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <ChartCard title="Конверсия по каналам" description="Доля лидов, дошедших до оплаты">
        <BarList
          items={rows
            .filter((r) => r.leads > 0)
            .sort((a, b) => b.conversion - a.conversion)
            .map((r) => ({ key: r.source, label: <SourceLabel source={r.source} />, value: r.conversion, display: formatPercent(r.conversion), secondary: `${r.won} из ${r.leads}` }))}
        />
      </ChartCard>
    </div>
  );
}

/* ───────────── Конверсия ───────────── */

export function ConversionSection({ data, period, now }: SectionProps) {
  const steps = funnelData(data, period, now);
  const buckets = bucketSeries(data, period, now);
  const w = getPeriodWindow(period, now);
  const lost: Deal[] = lostBetween(data.deals, w.start, w.end);
  const reasons = Object.entries(
    lost.reduce<Record<string, number>>((acc, d) => {
      const key = d.lostReason ?? "Не указана";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const stageLost = Object.entries(
    lost.reduce<Record<string, number>>((acc, d) => {
      const reach = Math.min(d.stageReached, 4);
      const stage = (["new", "contact", "qualification", "proposal", "negotiation"] as const)[reach]!;
      acc[stage] = (acc[stage] ?? 0) + 1;
      return acc;
    }, {}),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Воронка периода" description="Новые лиды и путь закрытых сделок">
          <FunnelChart steps={steps} />
        </ChartCard>
        <ChartCard
          title="Конверсия по времени"
          description={period === "1y" ? "По месяцам" : "За последние 4 недели на каждую дату"}
          legend={
            <ChartLegend
              items={[
                { label: "Лид → оплата", color: "var(--primary)" },
                { label: "Доля выигранных", color: "var(--muted-foreground)", shape: "dashed" },
              ]}
            />
          }
        >
          <TrendChart
            data={buckets.map((b) => ({ label: b.label, title: b.title, conversion: b.rollingConversion, winRate: b.rollingWinRate }))}
            height={300}
            format={(v) => formatPercent(v)}
            yDomain={[0, "auto"]}
            series={[
              { key: "winRate", label: "Доля выигранных", type: "line", color: "var(--muted-foreground)", dashed: true, muted: true },
              { key: "conversion", label: "Лид → оплата", type: "line", color: "var(--primary)" },
            ]}
          />
        </ChartCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Почему проигрываем" description={`${formatCount(lost.length, ["проигранная сделка", "проигранные сделки", "проигранных сделок"])} за период`}>
          <BarList items={reasons.map(([reason, count]) => ({ key: reason, label: reason, value: count, display: formatNumber(count), secondary: formatPercent(count / (lost.length || 1)) }))} />
        </ChartCard>
        <ChartCard title="На каком этапе теряем" description="Последний этап проигранных сделок">
          <BarList
            items={stageLost
              .sort((a, b) => b[1] - a[1])
              .map(([stage, count]) => ({
                key: stage,
                label: (
                  <span className="flex items-center gap-2">
                    <StageDot stage={stage as Deal["stage"]} />
                    {stageLabel(stage as Deal["stage"])}
                  </span>
                ),
                value: count,
                display: formatNumber(count),
              }))}
          />
        </ChartCard>
      </div>
    </div>
  );
}
