"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BarListItem {
  key: string;
  label: React.ReactNode;
  value: number;
  display: string;
  secondary?: string;
  onClick?: () => void;
}

/**
 * Горизонтальные полосы одного цвета: длина — величина, подпись и значение —
 * текстом рядом. Удобнее кольца, когда категорий больше пяти.
 */
export function BarList({ items, className, color = "var(--primary)" }: { items: BarListItem[]; className?: string; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <ul className={cn("grid gap-2.5", className)}>
      {items.map((item) => {
        const width = item.value > 0 ? `${Math.max(2, (item.value / max) * 100)}%` : "0%";
        const Row = item.onClick ? "button" : "div";
        return (
          <li key={item.key}>
            <Row
              type={item.onClick ? "button" : undefined}
              onClick={item.onClick}
              title={`${typeof item.label === "string" ? item.label : ""} ${item.display}`}
              className={cn("group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-left", item.onClick && "cursor-pointer")}
            >
              <span className="flex min-w-0 items-center gap-2 truncate text-[13px]">{item.label}</span>
              <span className="tabular text-right text-[13px] font-semibold">
                {item.display}
                {item.secondary && <span className="ml-2 text-xs font-normal text-muted-foreground">{item.secondary}</span>}
              </span>
              <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full transition-[width,opacity] duration-700 ease-out group-hover:opacity-80"
                  style={{ width: mounted ? width : "0%", background: color }}
                />
              </span>
            </Row>
          </li>
        );
      })}
    </ul>
  );
}
