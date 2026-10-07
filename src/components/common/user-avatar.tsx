import * as React from "react";
import { cn, initials } from "@/lib/utils";

const sizes = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
  xl: "size-16 text-xl",
} as const;

/** Стабильный оттенок из строки — у клиентов и лидов нет сохранённого цвета */
export function hueFromString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) % 360;
  return hash;
}

export function UserAvatar({
  name,
  hue,
  size = "md",
  online,
  shape = "circle",
  className,
}: {
  name: string;
  hue?: number;
  size?: keyof typeof sizes;
  online?: boolean;
  shape?: "circle" | "square";
  className?: string;
}) {
  const h = hue ?? hueFromString(name);
  return (
    <span
      title={name}
      style={{ "--h": h } as React.CSSProperties}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center font-semibold",
        "bg-[oklch(0.93_0.045_var(--h))] text-[oklch(0.4_0.12_var(--h))] dark:bg-[oklch(0.33_0.06_var(--h))] dark:text-[oklch(0.9_0.06_var(--h))]",
        shape === "circle" ? "rounded-full" : "rounded-[30%]",
        sizes[size],
        className,
      )}
    >
      {initials(name)}
      {online !== undefined && (
        <span
          aria-label={online ? "в сети" : "не в сети"}
          className={cn(
            "absolute -bottom-px -right-px size-[30%] min-h-2 min-w-2 rounded-full ring-2 ring-background",
            online ? "bg-success" : "bg-muted-foreground/40",
          )}
        />
      )}
    </span>
  );
}

export function AvatarStack({ names, max = 4, size = "sm" }: { names: { name: string; hue?: number }[]; max?: number; size?: keyof typeof sizes }) {
  const visible = names.slice(0, max);
  const rest = names.length - visible.length;
  return (
    <span className="flex -space-x-1.5">
      {visible.map((p) => (
        <UserAvatar key={p.name} name={p.name} hue={p.hue} size={size} className="ring-2 ring-card" />
      ))}
      {rest > 0 && (
        <span className={cn("inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-card", sizes[size])}>
          +{rest}
        </span>
      )}
    </span>
  );
}
