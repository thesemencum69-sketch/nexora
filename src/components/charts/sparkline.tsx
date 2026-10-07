"use client";

import * as React from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { cn } from "@/lib/utils";

/** Мини-тренд для KPI: линия приглушённая, текущая точка — акцентом */
export function Sparkline({ data, className, label }: { data: number[]; className?: string; label?: string }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const points = data.map((value, index) => ({ index, value }));
  const last = points.length - 1;

  return (
    <div className={cn("h-9 w-full", className)} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 120, height: 36 }}>
        <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.14} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--muted-foreground)"
            strokeOpacity={0.55}
            strokeWidth={1.5}
            fill={`url(#spark-${id})`}
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; index?: number }) =>
              props.index === last && props.cx !== undefined && props.cy !== undefined ? (
                <circle key="last" cx={props.cx} cy={props.cy} r={3} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
              ) : (
                <g key={props.index} />
              )
            }
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
