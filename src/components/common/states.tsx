"use client";

import * as React from "react";
import { RotateCcw, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Пустое состояние: вместо пустой таблицы — объяснение и следующее действие */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-16", className)}>
      <div className="relative mb-4">
        <div aria-hidden className="absolute -inset-6 rounded-full bg-[radial-gradient(circle,var(--primary-soft),transparent_70%)]" />
        <div className="relative flex size-12 items-center justify-center rounded-xl border bg-card text-muted-foreground shadow-card">
          <Icon className="size-5" />
        </div>
      </div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Что-то пошло не так",
  description = "Не удалось загрузить данные. Проверьте соединение и попробуйте ещё раз.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/8 text-critical-text">
        <TriangleAlert className="size-5" />
      </div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RotateCcw />
          Повторить
        </Button>
      )}
    </div>
  );
}
