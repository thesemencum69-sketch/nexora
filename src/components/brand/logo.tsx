import { cn } from "@/lib/utils";

/** Знак Nexora: «N», собранная из двух узлов и связи — сеть контактов */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="28" height="28" rx="8.5" fill="var(--primary)" />
      <path
        d="M9 19.5V8.5L19 19.5V8.5"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="19" cy="8.5" r="2.4" fill="var(--primary-foreground)" />
      <circle cx="9" cy="19.5" r="2.4" fill="var(--primary-foreground)" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && <span className="text-[19px] font-[650] tracking-[-0.035em]">Nexora</span>}
    </span>
  );
}
