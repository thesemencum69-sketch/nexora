"use client";

import * as React from "react";
import Link from "next/link";
import { Activity as ActivityIcon } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DonutChart } from "@/components/charts/donut-chart";
import { ActivityFeed } from "@/components/common/activity-feed";
import { EmptyState } from "@/components/common/states";
import { UserAvatar } from "@/components/common/user-avatar";
import { useCrm } from "@/hooks/use-crm";
import { sourceDonut, type MemberPerformance, type SourceRow } from "@/lib/metrics";
import { formatDuration, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PlanBar, percent, usePlanSummary } from "@/components/plans/sales-plan";
import { monthName } from "@/lib/plans";

export function ActivityCard({ className }: { className?: string }) {
  const activities = useCrm((s) => s.activities);
  const [expanded, setExpanded] = React.useState(false);
  const list = activities.slice(0, expanded ? 40 : 12);

  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <div>
          <CardTitle>Последняя активность</CardTitle>
          <CardDescription>Что команда сделала недавно</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="relative min-h-[400px] flex-1 p-0 xl:min-h-0">
        {list.length ? (
          <div className="scrollbar-thin absolute inset-0 overflow-y-auto px-2.5 pb-2 pt-3">
            <ActivityFeed activities={list} dense />
          </div>
        ) : (
          <EmptyState compact icon={ActivityIcon} title="Пока тихо" description="Здесь появятся новые лиды, сделки и комментарии команды." />
        )}
      </CardContent>
      {activities.length > 12 && (
        <div className="border-t px-5 py-2.5">
          <Button variant="ghost" size="xs" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Свернуть" : "Показать больше"}
          </Button>
        </div>
      )}
    </Card>
  );
}

export function SourcesCard({ rows, className }: { rows: SourceRow[]; className?: string }) {
  const total = rows.reduce((acc, r) => acc + r.leads, 0);
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <div>
          <CardTitle>Источники лидов</CardTitle>
          <CardDescription>Откуда пришли новые заявки</CardDescription>
        </div>
        <CardAction>
          <Button asChild variant="ghost" size="xs">
            <Link href="/analytics?tab=sources">Отчёт</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-5">
        {total ? (
          <DonutChart data={sourceDonut(rows)} centerValue={formatNumber(total)} centerLabel="лидов" />
        ) : (
          <EmptyState compact icon={ActivityIcon} title="Нет лидов за период" description="Выберите период подлиннее или подключите каналы заявок." />
        )}
      </CardContent>
    </Card>
  );
}

export function TeamCard({ rows, now, className }: { rows: MemberPerformance[]; now: number; className?: string }) {
  const plan = usePlanSummary(now);
  const planOf = new Map(plan.rows.map((r) => [r.member.id, r]));
  const sellers = rows.filter((r) => planOf.has(r.member.id) || (r.member.role !== "owner" && (r.leads > 0 || r.won > 0 || r.openDeals > 0)));
  const max = Math.max(1, ...sellers.map((r) => r.revenue));
  const hasPlans = plan.rows.length > 0;
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <div>
          <CardTitle>Менеджеры</CardTitle>
          <CardDescription>
            {hasPlans ? `Выручка за период и план на ${monthName(plan.month)}: команда выполнила ${percent(plan.share)}` : "Выручка, закрытые сделки и скорость ответа"}
          </CardDescription>
        </div>
        <CardAction>
          <Button asChild variant="ghost" size="xs">
            <Link href="/team">Команда</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="-mx-1 overflow-x-auto">
          <table className={cn("w-full text-[13px]", hasPlans ? "min-w-[680px]" : "min-w-[520px]")}>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-1 pb-2 font-medium">Сотрудник</th>
                <th className="px-1 pb-2 font-medium">Выручка</th>
                {hasPlans && <th className="px-1 pb-2 pl-4 font-medium">План на {monthName(plan.month)}</th>}
                <th className="px-1 pb-2 text-right font-medium">Сделки</th>
                <th className="px-1 pb-2 text-right font-medium">Win rate</th>
                <th className="px-1 pb-2 text-right font-medium">Ответ лиду</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((r) => (
                <tr key={r.member.id} className="border-t">
                  <td className="px-1 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <UserAvatar name={r.member.name} hue={r.member.hue} size="sm" online={r.member.online} />
                      <span className="truncate font-medium">{r.member.name}</span>
                    </span>
                  </td>
                  <td className="w-[34%] px-1 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <span className="tabular w-[92px] shrink-0 font-semibold">{formatMoney(r.revenue)}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.revenue / max) * 100}%` }} />
                      </span>
                    </span>
                  </td>
                  {hasPlans && (
                    <td className="w-[22%] px-1 py-2.5 pl-4">
                      {planOf.get(r.member.id) ? (
                        <span className="flex items-center gap-2.5">
                          <span className="tabular w-9 shrink-0 font-semibold">{percent(planOf.get(r.member.id)!.share)}</span>
                          <PlanBar share={planOf.get(r.member.id)!.share} elapsed={plan.elapsed} className="flex-1" />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )}
                  <td className="tabular px-1 py-2.5 text-right">{r.won}</td>
                  <td className="tabular px-1 py-2.5 text-right">{r.won + r.lost ? formatPercent(r.winRate) : "—"}</td>
                  <td className="tabular px-1 py-2.5 text-right text-muted-foreground">{r.avgResponseMin !== null ? formatDuration(r.avgResponseMin) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
