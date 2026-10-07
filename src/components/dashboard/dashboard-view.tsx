"use client";

import * as React from "react";
import { CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { PageSkeleton } from "@/components/common/skeletons";
import { QuickCreate } from "@/components/layout/quick-create";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrm, useCurrentUser, useNow, useReady } from "@/hooks/use-crm";
import {
  NO_FILTERS,
  PERIODS,
  attention,
  computeKpis,
  filterDataset,
  funnelData,
  periodMeta,
  sourceBreakdown,
  teamPerformance,
  type AnalyticsFilters,
  type PeriodKey,
} from "@/lib/metrics";
import { AttentionCard } from "./attention-card";
import { FiltersPopover } from "./filters-popover";
import { FunnelCard } from "./funnel-card";
import { KpiCard } from "./kpi-card";
import { RevenueCard } from "./revenue-card";
import { ActivityCard, SourcesCard, TeamCard } from "./side-cards";
import { TodayTasksCard } from "./today-tasks-card";

function greeting(now: number) {
  const hour = new Date(now).getHours();
  if (hour >= 5 && hour < 12) return "Доброе утро";
  if (hour >= 12 && hour < 18) return "Добрый день";
  if (hour >= 18 && hour < 23) return "Добрый вечер";
  return "Доброй ночи";
}

export function DashboardView() {
  const ready = useReady();
  if (!ready) return <PageSkeleton variant="dashboard" />;
  return <Dashboard />;
}

function Dashboard() {
  const [period, setPeriod] = React.useState<PeriodKey>("30d");
  const [filters, setFilters] = React.useState<AnalyticsFilters>(NO_FILTERS);
  const user = useCurrentUser();
  const deals = useCrm((s) => s.deals);
  const leads = useCrm((s) => s.leads);
  const tasks = useCrm((s) => s.tasks);
  const members = useCrm((s) => s.members);
  const now = useNow();

  const data = React.useMemo(() => filterDataset({ deals, leads }, filters), [deals, leads, filters]);
  const kpis = React.useMemo(() => computeKpis(data, period, now), [data, period, now]);
  const funnel = React.useMemo(() => funnelData(data, period, now), [data, period, now]);
  const sources = React.useMemo(() => sourceBreakdown(data, period, now), [data, period, now]);
  const team = React.useMemo(() => teamPerformance(members, data, period, now), [members, data, period, now]);
  const focus = React.useMemo(() => attention(deals, leads, tasks, now), [deals, leads, tasks, now]);
  const compare = periodMeta(period).compare;
  const [hero, ...rest] = kpis;

  return (
    <div className="animate-page space-y-6">
      <PageHeader
        title={`${greeting(now)}, ${user?.name.split(" ")[0] ?? "Семен"}`}
        description="Вот что происходит в вашей компании сегодня."
        actions={
          <>
            <Select value={period} onValueChange={(v: PeriodKey) => setPeriod(v)}>
              <SelectTrigger size="sm" className="w-[150px]" aria-label="Период">
                <CalendarRange className="size-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {PERIODS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FiltersPopover value={filters} onChange={setFilters} />
            <QuickCreate />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {hero && <KpiCard kpi={hero} compare={compare} hero className="col-span-2" />}
        {rest.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} compare={compare} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <RevenueCard className="xl:col-span-2" data={data} period={period} onPeriodChange={setPeriod} now={now} />
        <FunnelCard steps={funnel} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4">
          <AttentionCard data={focus} now={now} />
          <SourcesCard rows={sources} />
        </div>
        <TodayTasksCard now={now} />
        <ActivityCard className="md:col-span-2 xl:col-span-1" />
      </div>

      <TeamCard rows={team} now={now} />
    </div>
  );
}
