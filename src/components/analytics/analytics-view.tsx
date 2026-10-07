"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";
import type { ID, LeadSource } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SourceIcon } from "@/components/common/entity-meta";
import { PageHeader } from "@/components/common/page-header";
import { PageSkeleton } from "@/components/common/skeletons";
import { UserAvatar } from "@/components/common/user-avatar";
import { useClientMap, useCrm, useMemberMap, useNow, useReady } from "@/hooks/use-crm";
import { SOURCES, SOURCE_BY_ID } from "@/lib/constants";
import { stageLabel } from "@/lib/stages";
import { downloadCsv } from "@/lib/export";
import { formatDate } from "@/lib/format";
import { PERIODS, filterDataset, getPeriodWindow, type PeriodKey } from "@/lib/metrics";
import { accountName } from "@/lib/display";
import {
  ConversionSection,
  EmployeesSection,
  LeadsSection,
  RevenueSection,
  SalesSection,
  SourcesSection,
  type SectionProps,
} from "./analytics-sections";

const TABS = [
  { value: "sales", label: "Продажи" },
  { value: "revenue", label: "Выручка" },
  { value: "leads", label: "Лиды" },
  { value: "employees", label: "Сотрудники" },
  { value: "sources", label: "Источники" },
  { value: "conversion", label: "Конверсия" },
] as const;
type TabValue = (typeof TABS)[number]["value"];

export function AnalyticsView() {
  const ready = useReady();
  if (!ready) return <PageSkeleton variant="dashboard" />;
  return <Analytics />;
}

function Analytics() {
  const params = useSearchParams();
  const deals = useCrm((s) => s.deals);
  const leads = useCrm((s) => s.leads);
  const clients = useCrm((s) => s.clients);
  const membersList = useCrm((s) => s.members);
  const members = useMemberMap();
  const clientMap = useClientMap();
  const now = useNow();

  const initialTab = params.get("tab") as TabValue | null;
  const [tab, setTab] = React.useState<TabValue>(TABS.some((t) => t.value === initialTab) ? initialTab! : "sales");
  const [period, setPeriod] = React.useState<PeriodKey>("3m");
  const [owner, setOwner] = React.useState<ID | "all">("all");
  const [source, setSource] = React.useState<LeadSource | "all">("all");
  const [status, setStatus] = React.useState<SectionProps["status"]>("all");

  const data = React.useMemo(() => filterDataset({ deals, leads }, { ownerId: owner, source }), [deals, leads, owner, source]);
  const props: SectionProps = { data, period, now, members: membersList, clients, status };

  const exportDeals = () => {
    const w = getPeriodWindow(period, now);
    const rows = data.deals
      .filter((d) => Date.parse(d.createdAt) >= w.start || (d.closedAt && Date.parse(d.closedAt) >= w.start))
      .filter((d) => status === "all" || (status === "open" ? !d.closedAt : d.stage === status))
      .map((d) => [
        d.title,
        accountName(clientMap.get(d.clientId)),
        stageLabel(d.stage),
        d.amount,
        members.get(d.ownerId)?.name ?? "",
        SOURCE_BY_ID[d.source].label,
        formatDate(d.createdAt, now),
        d.closedAt ? formatDate(d.closedAt, now) : "",
      ]);
    downloadCsv(`nexora-deals-${period}.csv`, ["Сделка", "Клиент", "Этап", "Сумма", "Ответственный", "Источник", "Создана", "Закрыта"], rows);
    toast.success("Отчёт выгружен", { description: `${rows.length} сделок в CSV` });
  };

  return (
    <div className="animate-page space-y-5">
      <PageHeader
        title="Аналитика"
        description="Продажи, лиды и работа команды — все цифры считаются из ваших сделок"
        actions={
          <Button variant="outline" size="sm" onClick={exportDeals}>
            <Download />
            Выгрузить в CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented size="sm" value={period} onValueChange={setPeriod} options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} aria-label="Период" />
        <Select value={owner} onValueChange={(v: ID | "all") => setOwner(v)}>
          <SelectTrigger size="sm" className="w-auto min-w-[160px]" aria-label="Менеджер">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все менеджеры</SelectItem>
            {membersList.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <UserAvatar name={m.name} hue={m.hue} size="xs" />
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(v: LeadSource | "all") => setSource(v)}>
          <SelectTrigger size="sm" className="w-auto min-w-[150px]" aria-label="Источник">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все источники</SelectItem>
            {SOURCES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <SourceIcon source={s.id} />
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v: SectionProps["status"]) => setStatus(v)}>
          <SelectTrigger size="sm" className="w-auto min-w-[150px]" aria-label="Статус сделок">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все сделки</SelectItem>
            <SelectItem value="won">Выигранные</SelectItem>
            <SelectItem value="lost">Проигранные</SelectItem>
            <SelectItem value="open">В работе</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="sales" className="pt-5">
          <SalesSection {...props} />
        </TabsContent>
        <TabsContent value="revenue" className="pt-5">
          <RevenueSection {...props} />
        </TabsContent>
        <TabsContent value="leads" className="pt-5">
          <LeadsSection {...props} />
        </TabsContent>
        <TabsContent value="employees" className="pt-5">
          <EmployeesSection {...props} />
        </TabsContent>
        <TabsContent value="sources" className="pt-5">
          <SourcesSection {...props} />
        </TabsContent>
        <TabsContent value="conversion" className="pt-5">
          <ConversionSection {...props} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
