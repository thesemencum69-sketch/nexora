"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Копирование в буфер с подтверждением: иконка сменяется на галочку */
export function CopyButton({ value, label = "Скопировать", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Скопировано", { description: value });
    } catch {
      toast.error("Не удалось скопировать", { description: "Браузер запретил доступ к буферу обмена." });
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-all hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      {copied ? <Check className="size-3.5 animate-pop text-success-text" /> : <Copy className="size-3.5" />}
    </button>
  );
}
