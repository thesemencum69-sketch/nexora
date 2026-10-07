import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Компактный показатель для шапки раздела */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "critical" | "success";
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-card", className)}>
      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        {Icon && (
          <Icon
            className={cn(
              "size-3.5",
              tone === "critical" && "text-critical-text",
              tone === "success" && "text-success-text",
            )}
          />
        )}
        {label}
      </div>
      <div className="mt-1.5 text-[22px] font-semibold leading-tight tracking-[-0.02em]">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
