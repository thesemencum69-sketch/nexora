"use client";

import * as React from "react";
import { ChartColumn, LayoutDashboard, ListChecks, Magnet, Search, Settings, Sparkles, SquareKanban, Users, Workflow } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { TrendChart } from "@/components/charts/trend-chart";
import { ChartLegend } from "@/components/charts/chart-tooltip";
import { FunnelChart } from "@/components/charts/funnel-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Skeleton } from "@/components/ui/misc";
import { generateDemoData } from "@/lib/demo/generate";
import { formatMoneyCompact, formatMoney, formatNumber } from "@/lib/format";
import { computeKpis, funnelData, revenueSeries, sourceBreakdown, sourceDonut } from "@/lib/metrics";
import { cn } from "@/lib/utils";

/** Данные считаются теми же функциями, что и в продукте — превью не расходится с CRM */
function usePreviewData() {
  const [data, setData] = React.useState<ReturnType<typeof build> | null>(null);
  React.useEffect(() => {
    const id = window.setTimeout(() => setData(build(Date.now())), 0);
    return () => window.clearTimeout(id);
  }, []);
  return data;
}

function build(now: number) {
  const demo = generateDemoData({ now });
  const dataset = { deals: demo.deals, leads: demo.leads };
  return {
    kpis: computeKpis(dataset, "30d", now),
    revenue: revenueSeries(dataset, "30d", now),
    funnel: funnelData(dataset, "3m", now),
    sources: sourceDonut(sourceBreakdown(dataset, "30d", now)),
  };
}

const SIDEBAR = [LayoutDashboard, SquareKanban, Magnet, Users, ListChecks, ChartColumn, Workflow, Sparkles, Settings];

export function ProductPreview({ className }: { className?: string }) {
  const data = usePreviewData();
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-canvas shadow-overlay", className)} aria-label="Интерфейс Nexora: главная страница">
      <div className="flex items-center gap-1.5 border-b bg-background/70 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="mx-auto flex items-center gap-1.5 rounded-md bg-muted px-3 py-1 text-[11px] text-muted-foreground">
          <Search className="size-3" />
          app.nexora.ru/dashboard
        </span>
      </div>
      <div className="flex">
        <div className="hidden w-14 shrink-0 flex-col items-center gap-3 border-r bg-sidebar py-4 sm:flex">
          <LogoMark className="size-6" />
          {SIDEBAR.map((Icon, i) => (
            <span key={i} className={cn("flex size-8 items-center justify-center rounded-lg", i === 0 ? "bg-background text-primary shadow-card" : "text-muted-foreground")}>
              <Icon className="size-4" />
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-3 bg-background p-3 sm:p-5">
          <div>
            <p className="text-lg font-semibold tracking-[-0.02em]">Добрый день, Семен</p>
            <p className="text-xs text-muted-foreground">Вот что происходит в вашей компании сегодня.</p>
          </div>
          {data ? (
            <>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {data.kpis.slice(0, 4).map((k) => (
                  <KpiCard key={k.id} kpi={k} compare="к прошлым 30 дням" compact className="p-3" />
                ))}
              </div>
              <div className="grid gap-3 lg:grid-cols-5">
                <div className="rounded-xl border bg-card p-4 shadow-card lg:col-span-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold">Выручка</p>
                      <p className="tabular text-xl font-semibold tracking-[-0.02em]">{formatMoney(data.revenue[data.revenue.length - 1]!.cumulative)}</p>
                    </div>
                    <ChartLegend
                      items={[
                        { label: "Этот период", color: "var(--primary)" },
                        { label: "Прошлый", color: "var(--muted-foreground)", shape: "dashed" },
                      ]}
                    />
                  </div>
                  <TrendChart
                    data={data.revenue.map((p) => ({ label: p.label, title: p.title, current: p.cumulative, previous: p.prevCumulative }))}
                    height={190}
                    format={formatMoney}
                    axisFormat={(v) => formatMoneyCompact(v, false)}
                    series={[
                      { key: "previous", label: "Прошлый период", type: "line", color: "var(--muted-foreground)", dashed: true, muted: true },
                      { key: "current", label: "Этот период", type: "area", color: "var(--primary)" },
                    ]}
                  />
                </div>
                <div className="rounded-xl border bg-card p-4 shadow-card lg:col-span-2">
                  <p className="mb-3 text-[13px] font-semibold">Воронка за 3 месяца</p>
                  <FunnelChart steps={data.funnel} />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-[120px] rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-[280px] rounded-xl" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Отдельные виджеты для блоков лендинга */
export function SourcesPreview() {
  const data = usePreviewData();
  if (!data) return <Skeleton className="h-[200px] rounded-xl" />;
  const total = data.sources.reduce((a, s) => a + s.value, 0);
  return <DonutChart data={data.sources} centerValue={formatNumber(total)} centerLabel="лидов" size={150} />;
}
