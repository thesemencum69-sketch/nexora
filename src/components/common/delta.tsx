import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatDelta, formatPoints } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Изменение к прошлому периоду: знак, стрелка и цвет — никогда только цвет */
export function Delta({
  value,
  kind = "ratio",
  invert = false,
  className,
}: {
  value: number | null;
  kind?: "ratio" | "points";
  invert?: boolean;
  className?: string;
}) {
  if (value === null || !Number.isFinite(value) || Math.abs(value) < 0.0005) {
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground", className)}>
        <Minus className="size-3.5" />
        {value === null ? "нет данных" : "без изменений"}
      </span>
    );
  }
  const up = value > 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-semibold",
        good ? "text-success-text" : "text-critical-text",
        className,
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.5} />
      {kind === "points" ? formatPoints(value) : formatDelta(value)}
    </span>
  );
}
