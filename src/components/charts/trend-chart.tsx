"use client";

import * as React from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipCard, type TooltipRow } from "./chart-tooltip";

export interface TrendSeries {
  key: string;
  label: string;
  type: "area" | "line" | "bar";
  color: string;
  dashed?: boolean;
  muted?: boolean;
  stackId?: string;
}

type Datum = Record<string, string | number | null>;

/**
 * Универсальный график по времени: одна ось Y, тонкие линии, мягкая заливка,
 * вертикальный курсор и подсказка со всеми сериями в точке.
 */
export function TrendChart({
  data,
  series,
  xKey = "label",
  titleKey = "title",
  height = 260,
  format,
  axisFormat,
  yDomain,
  showYAxis = true,
}: {
  data: Datum[];
  series: TrendSeries[];
  xKey?: string;
  titleKey?: string;
  height?: number;
  format: (value: number) => string;
  axisFormat?: (value: number) => string;
  yDomain?: [number | "auto", number | "auto"];
  showYAxis?: boolean;
}) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const hasBars = series.some((s) => s.type === "bar");

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: showYAxis ? 0 : 8 }} barCategoryGap="22%">
          <defs>
            {series
              .filter((s) => s.type === "area")
              .map((s) => (
                <linearGradient key={s.key} id={`fill-${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.01} />
                </linearGradient>
              ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={28}
            interval="preserveStartEnd"
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            hide={!showYAxis}
            width={64}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tickCount={5}
            domain={yDomain ?? [0, "auto"]}
            tickFormatter={(v: number) => (axisFormat ?? format)(v)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            cursor={hasBars ? { fill: "var(--accent)", opacity: 0.6 } : { stroke: "var(--muted-foreground)", strokeOpacity: 0.35, strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const datum = payload[0]!.payload as Datum;
              const rows: TooltipRow[] = series.map((s) => ({
                label: s.label,
                value: datum[s.key] === null ? "нет данных" : format(Number(datum[s.key] ?? 0)),
                color: s.color,
                muted: s.muted,
              }));
              return <ChartTooltipCard title={String(datum[titleKey] ?? datum[xKey])} rows={rows} />;
            }}
          />
          {series.map((s) => {
            if (s.type === "bar")
              return (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  stackId={s.stackId}
                  fill={s.color}
                  radius={s.stackId ? 0 : [4, 4, 0, 0]}
                  maxBarSize={24}
                  stroke={s.stackId ? "var(--card)" : undefined}
                  strokeWidth={s.stackId ? 2 : 0}
                  animationDuration={700}
                />
              );
            if (s.type === "line")
              return (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  type="monotone"
                  stroke={s.color}
                  strokeWidth={s.muted ? 1.5 : 2}
                  strokeDasharray={s.dashed ? "4 4" : undefined}
                  dot={false}
                  activeDot={s.muted ? false : { r: 4, strokeWidth: 2, stroke: "var(--card)", fill: s.color }}
                  animationDuration={800}
                />
              );
            return (
              <Area
                key={s.key}
                dataKey={s.key}
                type="monotone"
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#fill-${id}-${s.key})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: s.color }}
                animationDuration={800}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
