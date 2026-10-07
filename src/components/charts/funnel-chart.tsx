"use client";

import * as React from "react";
import type { FunnelStepData } from "@/lib/metrics";
import { formatMoneyCompact, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Воронка: полосы одного цвета по центру (ширина — доля от входа), справа —
 * количество и сумма, между шагами — конверсия. Читается сверху вниз.
 */
export function FunnelChart({ steps, className }: { steps: FunnelStepData[]; className?: string }) {
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <ol className={cn("grid", className)}>
      {steps.map((step, index) => {
        const width = `${Math.max(6, step.share * 100)}%`;
        const last = index === steps.length - 1;
        return (
          <li key={step.key}>
            {step.conversion !== null && (
              <div className="flex items-center gap-2 py-0.5 pl-[7.5rem] text-[11px] text-muted-foreground">
                <span className="h-3 w-px bg-border" />
                {formatPercent(step.conversion)} дошли
              </div>
            )}
            <div
              onMouseEnter={() => setHovered(step.key)}
              onMouseLeave={() => setHovered(null)}
              className={cn("grid grid-cols-[7rem_minmax(0,1fr)_5.5rem] items-center gap-2 transition-opacity", hovered && hovered !== step.key && "opacity-60")}
            >
              <span className={cn("truncate text-[13px]", last ? "font-semibold" : "text-foreground/90")}>{step.label}</span>
              <span className="relative flex h-7 items-center justify-center rounded-md bg-muted/70">
                <span
                  className="h-full rounded-md transition-[width] duration-700 ease-out"
                  style={{ width: mounted ? width : "0%", background: "var(--primary)", opacity: last ? 1 : 0.55 + 0.45 * step.share }}
                />
              </span>
              <span className="text-right leading-tight">
                <span className="tabular block text-[13px] font-semibold">{formatNumber(step.count)}</span>
                <span className="tabular block text-[11px] text-muted-foreground">{step.amount ? formatMoneyCompact(step.amount) : "—"}</span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
