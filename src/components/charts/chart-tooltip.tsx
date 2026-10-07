import * as React from "react";
import { cn } from "@/lib/utils";

export interface TooltipRow {
  label: string;
  value: string;
  color: string;
  /** muted — второстепенная строка (например, прошлый период) */
  muted?: boolean;
}

/** Подсказка графика: значение крупно, название серии — вторично, ключ — короткий штрих */
export function ChartTooltipCard({ title, rows, footer, className }: { title: React.ReactNode; rows: TooltipRow[]; footer?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-44 rounded-xl border bg-popover px-3 py-2.5 text-popover-foreground shadow-overlay", className)}>
      <div className="mb-1.5 text-xs text-muted-foreground">{title}</div>
      <div className="grid gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2.5">
            <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: row.color }} />
            <span className={cn("tabular text-[13px] font-semibold", row.muted && "font-medium text-muted-foreground")}>{row.value}</span>
            <span className="ml-auto pl-3 text-xs text-muted-foreground">{row.label}</span>
          </div>
        ))}
      </div>
      {footer && <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}

/** Легенда графика: ключ повторяет форму метки (линия или столбик) */
export function ChartLegend({ items, className }: { items: { label: string; color: string; shape?: "line" | "bar" | "dashed" }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          {item.shape === "bar" ? (
            <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: item.color }} />
          ) : item.shape === "dashed" ? (
            <span aria-hidden className="w-3.5 border-t-2 border-dashed" style={{ borderColor: item.color }} />
          ) : (
            <span aria-hidden className="h-0.5 w-3.5 rounded-full" style={{ background: item.color }} />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}
