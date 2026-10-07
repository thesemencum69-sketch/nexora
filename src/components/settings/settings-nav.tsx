"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_GROUPS, SETTINGS_SECTIONS } from "@/config/settings";
import { cn } from "@/lib/utils";

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Разделы настроек" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:block lg:space-y-5 lg:px-0">
      {SETTINGS_GROUPS.map((group) => (
        <div key={group} className="contents lg:block">
          <p className="hidden px-3 pb-1.5 text-xs font-medium text-muted-foreground/80 lg:block">{group}</p>
          <div className="contents lg:flex lg:flex-col lg:gap-0.5">
            {SETTINGS_SECTIONS.filter((s) => s.group === group).map((s) => {
              const active = pathname === `/settings/${s.id}`;
              return (
                <Link
                  key={s.id}
                  href={`/settings/${s.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                    active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <s.icon className={cn("size-4", active && "text-primary")} />
                  {s.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function SettingsCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-card", className)}>
      <header className="px-5 pt-5">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
      </header>
      <div className="px-5 pb-5 pt-4">{children}</div>
      {footer && <footer className="flex items-center justify-end gap-2 border-t bg-muted/30 px-5 py-3">{footer}</footer>}
    </section>
  );
}
