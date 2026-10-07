"use client";

import * as React from "react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { ChartLegend } from "@/components/charts/chart-tooltip";
import { TrendChart } from "@/components/charts/trend-chart";
import { Delta } from "@/components/common/delta";
import { PERIODS, bucketLabel, periodMeta, revenueSeries, type Dataset, type PeriodKey } from "@/lib/metrics";
import { formatMoney, formatMoneyCompact, formatNumber } from "@/lib/format";
import { cn, plural } from "@/lib/utils";

type Mode = "cumulative" | "period";

export function RevenueCard({
  data,
  period,
  onPeriodChange,
  now,
  className,
}: {
  data: Dataset;
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  now: number;
  className?: string;
}) {
  const [mode, setMode] = React.useState<Mode>("cumulative");
  const series = React.useMemo(() => revenueSeries(data, period, now), [data, period, now]);
  const last = series[series.length - 1];
  const total = last?.cumulative ?? 0;
  const prevTotal = last?.prevCumulative ?? 0;
  const deals = series.reduce((acc, p) => acc + p.deals, 0);
  const delta = prevTotal ? (total - prevTotal) / prevTotal : null;
  const step = bucketLabel(period);

  const chartData = series.map((p) => ({
    label: p.label,
    title: p.title,
    current: mode === "cumulative" ? p.cumulative : p.revenue,
    previous: mode === "cumulative" ? p.prevCumulative : p.prevRevenue,
    deals: p.deals,
  }));

  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader className="flex-wrap gap-y-3">
        <div>
          <CardTitle>Выручка</CardTitle>
          <CardDescription>Успешные сделки за период в сравнении с прошлым</CardDescription>
        </div>
        <CardAction className="max-sm:ml-0 max-sm:w-full">
          <Segmented
            size="sm"
            value={period}
            onValueChange={onPeriodChange}
            options={PERIODS.map((p) => ({ value: p.key, label: p.short }))}
            aria-label="Период графика"
          />
        </CardAction>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <div className="flex items-baseline gap-2.5">
              <span className="text-[28px] font-semibold leading-none tracking-[-0.03em]">{formatMoney(total)}</span>
              <Delta value={delta} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {formatNumber(deals)} {plural(deals, ["успешная сделка", "успешные сделки", "успешных сделок"])}, {periodMeta(period).compare}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
        </div>
        <TrendChart
          data={chartData}
          height={250}
          format={formatMoney}
          axisFormat={(v) => formatMoneyCompact(v, false)}
          series={[
            { key: "previous", label: "Прошлый период", type: "line", color: "var(--muted-foreground)", dashed: true, muted: true },
            { key: "current", label: "Этот период", type: "area", color: "var(--primary)" },
          ]}
        />
        <div className="mt-3 border-t pt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Успешные сделки {step}, шт.</span>
            <span className="tabular">всего {formatNumber(deals)}</span>
          </div>
          <TrendChart
            data={chartData}
            height={92}
            format={(v) => formatNumber(v)}
            series={[{ key: "deals", label: "Сделок", type: "bar", color: "var(--primary)" }]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
