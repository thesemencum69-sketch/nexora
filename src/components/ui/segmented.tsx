"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number;
}

/** Сегментированный переключатель: периоды, виды отображения, фильтры-вкладки */
function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  size = "default",
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  size?: "default" | "sm";
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("no-scrollbar inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium outline-none transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/40",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
              active ? "bg-card text-foreground shadow-card ring-1 ring-black/[0.04] dark:bg-accent dark:ring-white/[0.06]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon className="size-4" />}
            {option.label}
            {option.count !== undefined && (
              <span className={cn("tabular rounded-full px-1.5 text-[11px]", active ? "bg-muted text-muted-foreground" : "text-muted-foreground/80")}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export { Segmented, type SegmentedOption };
