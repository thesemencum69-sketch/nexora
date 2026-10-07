"use client";

import { Info } from "lucide-react";
import type { Kpi } from "@/lib/metrics";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { Sparkline } from "@/components/charts/sparkline";
import { Delta } from "@/components/common/delta";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function formatKpi(kpi: Pick<Kpi, "format" | "value">) {
  if (kpi.format === "money") return formatMoney(kpi.value);
  if (kpi.format === "percent") return formatPercent(kpi.value);
  return formatNumber(kpi.value);
}

/** Карточка показателя: значение, изменение к прошлому периоду, тренд и пояснение */
export function KpiCard({
  kpi,
  compare,
  hero = false,
  compact = false,
  className,
}: {
  kpi: Kpi;
  compare: string;
  hero?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <section
      aria-label={kpi.label}
      className={cn(
        "group flex flex-col justify-between rounded-xl border bg-card p-4 shadow-card transition-shadow duration-200 hover:shadow-raised",
        hero && "sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end sm:gap-6 sm:p-5",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          {kpi.label}
          <Hint label={kpi.hint}>
            <button type="button" className="rounded-full text-muted-foreground/60 outline-none transition-colors hover:text-foreground focus-visible:text-foreground" aria-label={`Что такое «${kpi.label}»`}>
              <Info className="size-3.5" />
            </button>
          </Hint>
        </div>
        <div
          className={cn(
            "mt-2 font-semibold leading-none",
            hero ? "text-[34px] tracking-[-0.035em] sm:text-[40px]" : compact ? "text-[19px] tracking-[-0.02em]" : "text-[26px] tracking-[-0.03em]",
          )}
        >
          {formatKpi(kpi)}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <Delta value={kpi.delta} kind={kpi.deltaKind} />
          <span className="text-xs text-muted-foreground">{compare}</span>
        </div>
      </div>
      <Sparkline
        data={kpi.spark}
        label={`Динамика показателя «${kpi.label}»`}
        className={cn("mt-3", hero ? "h-12 min-w-0 sm:mt-0 sm:h-16" : compact ? "h-7" : "h-9")}
      />
    </section>
  );
}
