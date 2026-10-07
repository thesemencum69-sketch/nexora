"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ShareItem {
  key: string;
  /** Подпись для легенды (может содержать иконку) */
  label: React.ReactNode;
  /** Текстовое название — для подсказки и экранных читалок */
  name: string;
  value: number;
  color: string;
  display: string;
  secondary?: string;
}

/**
 * Состав целого одной полосой: сегменты — доли, под ними легенда с цифрами.
 * Выбранный сегмент подсвечивается, остальные приглушаются.
 */
export function ShareBar({
  items,
  active,
  onSelect,
  className,
}: {
  items: ShareItem[];
  active?: string | null;
  onSelect?: (key: string | null) => void;
  className?: string;
}) {
  const visible = items.filter((i) => i.value > 0);
  const summary = visible.map((i) => `${i.name}: ${i.display}`).join(", ");

  return (
    <div className={className}>
      <div className="flex h-2.5 w-full gap-[2px]" role="img" aria-label={summary}>
        {visible.map((item) => (
          <span
            key={item.key}
            title={`${item.name}: ${item.display}`}
            className={cn(
              "h-full min-w-[3px] transition-opacity duration-200 first:rounded-l-full last:rounded-r-full",
              active && active !== item.key && "opacity-25",
            )}
            style={{ flex: `${item.value} 1 0%`, background: item.color }}
          />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {visible.map((item) => {
          const selected = active === item.key;
          const Row = onSelect ? "button" : "div";
          return (
            <li key={item.key} className="min-w-0">
              <Row
                type={onSelect ? "button" : undefined}
                aria-pressed={onSelect ? selected : undefined}
                onClick={onSelect ? () => onSelect(selected ? null : item.key) : undefined}
                className={cn(
                  "-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1.5 text-left outline-none transition-[background-color,opacity] focus-visible:ring-2 focus-visible:ring-ring/40",
                  onSelect && "hover:bg-accent/60",
                  selected && "bg-accent",
                  active && !selected && "opacity-55",
                )}
              >
                <span className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">{item.label}</span>
                <span className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="tabular text-[17px] font-semibold tracking-[-0.01em]">{item.display}</span>
                  {item.secondary && <span className="tabular truncate text-xs text-muted-foreground">{item.secondary}</span>}
                </span>
              </Row>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
