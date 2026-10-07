"use client";

import Link from "next/link";
import { AlarmClock, CalendarX2, ChevronRight, Hourglass, MessageCircleWarning, ShieldCheck, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/states";
import type { AttentionData } from "@/lib/metrics";
import { formatMoneyCompact, formatRelative } from "@/lib/format";
import { useMemberMap } from "@/hooks/use-crm";
import { cn } from "@/lib/utils";

interface Row {
  key: string;
  icon: LucideIcon;
  tone: "critical" | "warning";
  title: string;
  detail: string;
  count: number;
  href: string;
}

/** «Фокус дня»: всё, что теряет деньги прямо сейчас, — в одном месте */
export function AttentionCard({ data, now, className }: { data: AttentionData; now: number; className?: string }) {
  const members = useMemberMap();
  const firstName = (id: string | null | undefined) => (id ? members.get(id)?.name.split(" ")[0] : undefined);

  const rows: Row[] = [
    {
      key: "leads",
      icon: MessageCircleWarning,
      tone: "critical" as const,
      title: "Лиды ждут ответа",
      detail: data.unansweredLeads[0]
        ? `${data.unansweredLeads[0].name}, заявка ${formatRelative(data.unansweredLeads[0].createdAt, now)}`
        : "",
      count: data.unansweredLeads.length,
      href: "/leads?status=new",
    },
    {
      key: "tasks",
      icon: AlarmClock,
      tone: "critical" as const,
      title: "Просроченные задачи",
      detail: data.overdueTasks[0] ? `«${data.overdueTasks[0].title}», ${firstName(data.overdueTasks[0].assigneeId) ?? ""}` : "",
      count: data.overdueTasks.length,
      href: "/tasks?tab=overdue",
    },
    {
      key: "stale",
      icon: Hourglass,
      tone: "warning" as const,
      title: "Сделки без движения 7+ дней",
      detail: data.staleDeals.length ? `На сумму ${formatMoneyCompact(data.staleDeals.reduce((a, d) => a + d.amount, 0))}` : "",
      count: data.staleDeals.length,
      href: "/deals?focus=stale",
    },
    {
      key: "close",
      icon: CalendarX2,
      tone: "warning" as const,
      title: "Прошёл срок закрытия",
      detail: data.overdueCloseDeals[0] ? `«${data.overdueCloseDeals[0].title}» и другие` : "",
      count: data.overdueCloseDeals.length,
      href: "/deals?focus=overdue",
    },
  ].filter((row) => row.count > 0);

  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <div>
          <CardTitle>Требует внимания</CardTitle>
          <CardDescription>Что теряет деньги прямо сейчас</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-3">
        {rows.length === 0 ? (
          <EmptyState compact icon={ShieldCheck} title="Всё под контролем" description="Нет просрочек, зависших сделок и лидов без ответа." />
        ) : (
          <ul className="grid gap-1">
            {rows.map((row) => (
              <li key={row.key} className="min-w-0">
                <Link
                  href={row.href}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2.5 outline-none transition-colors hover:bg-accent/70 focus-visible:bg-accent"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      row.tone === "critical" ? "bg-destructive/10 text-critical-text" : "bg-warning/15 text-warning-text",
                    )}
                  >
                    <row.icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium">{row.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{row.detail}</span>
                  </span>
                  <span className="tabular text-lg font-semibold">{row.count}</span>
                  <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
