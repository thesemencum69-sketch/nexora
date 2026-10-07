"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Copy, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import type { ID } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/states";
import { UserAvatar } from "@/components/common/user-avatar";
import { useCrm, useCurrentUser } from "@/hooks/use-crm";
import { formatCount, formatMoney, formatMoneyCompact, formatNumber } from "@/lib/format";
import { can } from "@/lib/permissions";
import { monthName, paceTone, planSummary, shiftMonth, type PlanSummary } from "@/lib/plans";
import { monthKey } from "@/lib/time";
import { cn } from "@/lib/utils";

const TONE_BAR = { ahead: "bg-success", on: "bg-primary", behind: "bg-warning" } as const;
const TONE_TEXT = { ahead: "text-success-text", on: "text-foreground", behind: "text-warning-text" } as const;

export const percent = (share: number) => `${Math.round(share * 100)}%`;

/**
 * Полоса выполнения плана. Тонкая риска — где надо быть сегодня при равномерном темпе:
 * видно, отстаёт человек или идёт с запасом, без лишних цифр.
 */
export function PlanBar({ share, elapsed, className }: { share: number; elapsed: number; className?: string }) {
  const tone = paceTone(share, elapsed);
  return (
    <span className={cn("relative block h-1.5 rounded-full bg-muted", className)} role="img" aria-label={`Выполнено ${percent(share)}, по темпу нужно ${percent(elapsed)}`}>
      <span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-500", TONE_BAR[tone])} style={{ width: `${Math.min(100, share * 100)}%` }} />
      {elapsed > 0 && elapsed < 1 && <span aria-hidden className="absolute -inset-y-[3px] w-[2px] rounded-full bg-foreground/35" style={{ left: `calc(${elapsed * 100}% - 1px)` }} />}
    </span>
  );
}

export function usePlanSummary(now: number, month?: string) {
  const plans = useCrm((s) => s.plans);
  const deals = useCrm((s) => s.deals);
  const members = useCrm((s) => s.members);
  return React.useMemo(() => planSummary({ plans, deals, members, now, month }), [plans, deals, members, now, month]);
}

/** Карточка «План продаж»: команда целиком и каждый менеджер */
export function SalesPlanCard({ now, className, editable = true }: { now: number; className?: string; editable?: boolean }) {
  const summary = usePlanSummary(now);
  const me = useCurrentUser();
  const [open, setOpen] = React.useState(false);
  const canEdit = editable && can(me?.role ?? "employee", "team.manage");
  const tone = paceTone(summary.share, summary.elapsed);

  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <div>
          <CardTitle>План продаж на {monthName(summary.month)}</CardTitle>
          <CardDescription>
            {summary.rows.length
              ? `Успешные сделки этого месяца против плана. До конца месяца ${formatCount(summary.daysLeft, ["день", "дня", "дней"])}`
              : "Поставьте менеджерам цель на месяц — прогресс будет считаться сам"}
          </CardDescription>
        </div>
        {canEdit && (
          <CardAction>
            <Button variant={summary.rows.length ? "ghost" : "default"} size="xs" onClick={() => setOpen(true)}>
              <Target />
              {summary.rows.length ? "Изменить план" : "Поставить план"}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="pt-3">
        {summary.rows.length === 0 ? (
          <EmptyState compact icon={Target} title="План на месяц не задан" description="Достаточно одной суммы на человека. Можно взять прошлый месяц за основу." />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div>
              <p className="text-[13px] text-muted-foreground">Команда</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className={cn("tabular text-[32px] font-semibold leading-none tracking-[-0.03em]", TONE_TEXT[tone])}>{percent(summary.share)}</span>
                <span className="text-[13px] text-muted-foreground">плана</span>
              </p>
              <p className="tabular mt-2 text-[13px]">
                <span className="font-semibold">{formatMoneyCompact(summary.fact)}</span>
                <span className="text-muted-foreground"> из {formatMoneyCompact(summary.plan)}</span>
              </p>
              <PlanBar share={summary.share} elapsed={summary.elapsed} className="mt-3" />
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="size-3.5" />
                При текущем темпе — {formatMoneyCompact(summary.projected)} к концу месяца
              </p>
            </div>
            <ul className="min-w-0 space-y-3">
              {summary.rows.map((r) => {
                const rowTone = paceTone(r.share, summary.elapsed);
                return (
                  <li key={r.member.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
                    <span className="flex min-w-0 items-center gap-2">
                      <UserAvatar name={r.member.name} hue={r.member.hue} size="xs" />
                      <span className="truncate text-[13px] font-medium">{r.member.name}</span>
                    </span>
                    <PlanBar share={r.share} elapsed={summary.elapsed} className="order-last col-span-2 sm:order-none sm:col-span-1" />
                    <span className="tabular whitespace-nowrap text-right text-[13px] sm:min-w-[176px]">
                      <span className={cn("font-semibold", TONE_TEXT[rowTone])}>{percent(r.share)}</span>
                      <span className="ml-2 text-muted-foreground max-sm:text-xs">
                        {formatMoneyCompact(r.fact, false)} из {formatMoneyCompact(r.plan, false)}
                      </span>
                    </span>
                  </li>
                );
              })}
              <li className="flex items-center gap-4 pt-1 text-[11.5px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-[2px] rounded-full bg-foreground/35" />
                  где нужно быть сегодня
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full bg-success" />
                  опережает
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full bg-warning" />
                  отстаёт
                </span>
              </li>
            </ul>
          </div>
        )}
      </CardContent>
      {canEdit && <PlanDialog open={open} onOpenChange={setOpen} now={now} />}
    </Card>
  );
}

const parseMoney = (value: string) => Number(value.replace(/[^\d]/g, "")) || 0;

/** Планы на месяц: по сумме на человека, с быстрыми подстановками */
export function PlanDialog({ open, onOpenChange, now }: { open: boolean; onOpenChange: (open: boolean) => void; now: number }) {
  const members = useCrm((s) => s.members);
  const plans = useCrm((s) => s.plans);
  const deals = useCrm((s) => s.deals);
  const setPlans = useCrm((s) => s.setPlans);
  const current = monthKey(now);
  const [month, setMonth] = React.useState(current);
  const [values, setValues] = React.useState<Record<ID, string>>({});

  const sellers = React.useMemo(
    () => members.filter((m) => m.position !== "Приглашение отправлено" && (m.role !== "owner" || plans.some((p) => p.memberId === m.id) || deals.some((d) => d.ownerId === m.id && d.stage === "won"))),
    [members, plans, deals],
  );

  const load = React.useCallback(
    (key: string) => {
      const next: Record<ID, string> = {};
      for (const m of sellers) {
        const plan = plans.find((p) => p.month === key && p.memberId === m.id);
        next[m.id] = plan ? formatNumber(plan.amount) : "";
      }
      setValues(next);
    },
    [plans, sellers],
  );

  React.useEffect(() => {
    if (open) {
      setMonth(current);
      load(current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const switchMonth = (delta: number) => {
    const next = shiftMonth(month, delta);
    setMonth(next);
    load(next);
  };

  const fromPrevious = (factor: number) => {
    const prev = shiftMonth(month, -1);
    const next: Record<ID, string> = {};
    let found = 0;
    for (const m of sellers) {
      const plan = plans.find((p) => p.month === prev && p.memberId === m.id);
      if (plan) found++;
      next[m.id] = plan ? formatNumber(Math.round((plan.amount * factor) / 10_000) * 10_000) : (values[m.id] ?? "");
    }
    if (!found) return toast("В прошлом месяце плана не было", { description: "Введите суммы вручную — это займёт минуту" });
    setValues(next);
  };

  const total = sellers.reduce((acc, m) => acc + parseMoney(values[m.id] ?? ""), 0);
  const summary: PlanSummary = planSummary({ plans, deals, members, now, month: shiftMonth(month, -1) });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setPlans(
      month,
      sellers.map((m) => ({ memberId: m.id, amount: parseMoney(values[m.id] ?? "") })),
    );
    onOpenChange(false);
    toast.success(`План на ${monthName(month)} сохранён`, { description: total ? `Команда: ${formatMoney(total)}` : "Планы очищены" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>План продаж</DialogTitle>
          <DialogDescription>Сумма успешных сделок, которую менеджер закроет за месяц. Пустое поле — без плана.</DialogDescription>
        </DialogHeader>
        <form id="plan-form" onSubmit={save} className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => switchMonth(-1)} disabled={month <= shiftMonth(current, -1)} aria-label="Предыдущий месяц">
                <ChevronLeft />
              </Button>
              <span className="min-w-[96px] text-center text-[14px] font-semibold capitalize">{monthName(month)}</span>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => switchMonth(1)} disabled={month >= shiftMonth(current, 2)} aria-label="Следующий месяц">
                <ChevronRight />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="xs" onClick={() => fromPrevious(1)}>
                <Copy />
                Как в прошлом
              </Button>
              <Button type="button" variant="outline" size="xs" onClick={() => fromPrevious(1.1)}>
                +10%
              </Button>
            </div>
          </div>
          <ul className="divide-y rounded-xl border">
            {sellers.map((m) => {
              const last = summary.rows.find((r) => r.member.id === m.id);
              return (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                  <UserAvatar name={m.name} hue={m.hue} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{m.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {last ? `В ${monthName(summary.month, "prepositional")}: ${formatMoneyCompact(last.fact)} из ${formatMoneyCompact(last.plan)}` : m.position}
                    </span>
                  </span>
                  <span className="relative w-36 shrink-0">
                    <Input
                      inputMode="numeric"
                      value={values[m.id] ?? ""}
                      onChange={(e) => {
                        const amount = parseMoney(e.target.value);
                        setValues((v) => ({ ...v, [m.id]: amount ? formatNumber(amount) : "" }));
                      }}
                      placeholder="Без плана"
                      className="tabular pr-7 text-right"
                      aria-label={`План: ${m.name}`}
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">₽</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="tabular flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">План команды</span>
            <span className="font-semibold">{formatMoney(total)}</span>
          </p>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="submit" form="plan-form">
            Сохранить план
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
