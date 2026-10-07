"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChartTooltipCard } from "./chart-tooltip";

export interface DonutDatum {
  key: string;
  label: string;
  value: number;
  share: number;
  color: string;
}

/** Кольцо «часть целого»: не больше шести сегментов, 2px зазор цвета фона между ними */
export function DonutChart({
  data,
  centerLabel,
  centerValue,
  className,
  size = 168,
}: {
  data: DonutDatum[];
  centerLabel: string;
  centerValue: string;
  className?: string;
  size?: number;
}) {
  const [active, setActive] = React.useState<string | null>(null);
  const visible = data.filter((d) => d.value > 0);

  return (
    <div className={cn("@container", className)}>
      <div className="flex flex-col items-center gap-5 @[25rem]:flex-row">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: size, height: size }}>
          <PieChart>
            <Pie
              data={visible}
              dataKey="value"
              nameKey="label"
              innerRadius="70%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={0}
              stroke="var(--card)"
              strokeWidth={2}
              cornerRadius={3}
              animationDuration={800}
              onMouseLeave={() => setActive(null)}
            >
              {visible.map((d) => (
                <Cell
                  key={d.key}
                  fill={d.color}
                  opacity={active && active !== d.key ? 0.35 : 1}
                  onMouseEnter={() => setActive(d.key)}
                  style={{ transition: "opacity 150ms" }}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active: isActive, payload }) => {
                if (!isActive || !payload?.length) return null;
                const d = payload[0]!.payload as DonutDatum;
                return (
                  <ChartTooltipCard
                    title={d.label}
                    rows={[
                      { label: "доля", value: formatPercent(d.share), color: d.color },
                      { label: "лидов", value: formatNumber(d.value), color: d.color, muted: true },
                    ]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-[-0.02em]">{centerValue}</span>
          <span className="text-xs text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <ul className="grid w-full gap-1.5">
        {data.map((d) => (
          <li
            key={d.key}
            onMouseEnter={() => setActive(d.key)}
            onMouseLeave={() => setActive(null)}
            className={cn("flex items-center gap-2.5 rounded-md px-1.5 py-1 text-[13px] transition-opacity", active && active !== d.key && "opacity-50")}
          >
            <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: d.color }} />
            <span className="truncate">{d.label}</span>
            <span className="tabular ml-auto font-medium">{formatPercent(d.share)}</span>
            <span className="tabular w-8 text-right text-xs text-muted-foreground">{d.value}</span>
          </li>
        ))}
      </ul>
      </div>
    </div>
  );
}
