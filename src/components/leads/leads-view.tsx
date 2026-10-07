"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { CircleSlash, Clock3, Download, FileUp, LayoutGrid, Magnet, MessageCircleWarning, MessagesSquare, Plus, Rows3, Target, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import type { ID, LeadSource, LeadStatus } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShareBar } from "@/components/charts/share-bar";
import { BulkBar, RowCheckbox, SelectAllCheckbox, useSelection } from "@/components/common/bulk";
import { Delta } from "@/components/common/delta";
import { ViewsBar } from "@/components/common/views-bar";
import { ImportDialog } from "@/components/import/import-wizard";
import { LeadStatusBadge, SourceIcon, SourceLabel } from "@/components/common/entity-meta";
import { PageHeader } from "@/components/common/page-header";
import { PageSkeleton } from "@/components/common/skeletons";
import { EmptyState } from "@/components/common/states";
import { StatTile } from "@/components/common/stat-tile";
import { Pagination, SearchInput, Th, usePagination } from "@/components/common/table-parts";
import { UserAvatar } from "@/components/common/user-avatar";
import { useCrm, useMemberMap, useNow, useReady } from "@/hooks/use-crm";
import { LEAD_RESPONSE_SLA_MIN, SOURCE_BY_ID, SOURCES } from "@/lib/constants";
import { downloadCsv } from "@/lib/export";
import { formatCount, formatDuration, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { averageResponse, getPeriodWindow, leadsBetween, sourceBreakdown } from "@/lib/metrics";
import { useUi } from "@/lib/store/ui-store";
import { MINUTE } from "@/lib/time";
import { cn, matchesQuery } from "@/lib/utils";
import { LeadCard, LeadMenu, LeadPrimaryAction, ResponseChip } from "./lead-card";

type StatusTab = "all" | LeadStatus;
const DEFAULT_FILTERS = { status: "all", source: "all", owner: "all", query: "" };
const STATUS_LABEL: Record<LeadStatus, string> = { new: "Новый", contacted: "В работе", qualified: "Квалифицирован", converted: "Сделка", disqualified: "Отказ" };

export function LeadsView() {
  const ready = useReady();
  if (!ready) return <PageSkeleton variant="cards" />;
  return <Leads />;
}

function Leads() {
  const params = useSearchParams();
  const leads = useCrm((s) => s.leads);
  const deals = useCrm((s) => s.deals);
  const members = useMemberMap();
  const openDialog = useUi((s) => s.openDialog);
  const now = useNow();

  const [query, setQuery] = React.useState(() => params.get("q") ?? "");
  const [status, setStatus] = React.useState<StatusTab>(() => (params.get("status") as StatusTab) ?? "all");
  const [source, setSource] = React.useState<LeadSource | "all">("all");
  const [owner, setOwner] = React.useState<ID | "all">("all");
  const [view, setView] = React.useState<"cards" | "table">("cards");
  const [importOpen, setImportOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const window30 = React.useMemo(() => getPeriodWindow("30d", now), [now]);
  const recent = React.useMemo(() => leadsBetween(leads, window30.start, window30.end), [leads, window30]);
  const previous = React.useMemo(() => leadsBetween(leads, window30.prevStart, window30.prevEnd), [leads, window30]);
  const sources = React.useMemo(() => sourceBreakdown({ leads, deals }, "30d", now), [leads, deals, now]);
  const waiting = leads.filter((l) => l.status === "new" && !l.firstResponseAt);
  const late = waiting.filter((l) => now - Date.parse(l.createdAt) > LEAD_RESPONSE_SLA_MIN * MINUTE);
  const converted = recent.filter((l) => l.status === "converted").length;
  const avgResponse = averageResponse(recent);

  const counts = React.useMemo(() => {
    const c: Record<StatusTab, number> = { all: leads.length, new: 0, contacted: 0, qualified: 0, converted: 0, disqualified: 0 };
    for (const l of leads) c[l.status]++;
    return c;
  }, [leads]);

  const filtered = React.useMemo(
    () =>
      leads.filter(
        (l) =>
          (status === "all" || l.status === status) &&
          (source === "all" || l.source === source) &&
          (owner === "all" || l.ownerId === owner) &&
          matchesQuery(query, l.name, l.company, l.phone, l.email),
      ),
    [leads, status, source, owner, query],
  );
  const pager = usePagination(filtered, view === "cards" ? 12 : 20, [status, source, owner, query, view]);
  const selection = useSelection(view === "table" ? pager.slice.map((l) => l.id) : []);
  const { bulkUpdateLeads, bulkDeleteLeads } = useCrm.getState();
  const done = (text: string) => {
    toast.success(text, { description: `Лидов: ${selection.count}` });
    selection.clear();
  };
  const exportSelected = () => {
    const picked = filtered.filter((l) => selection.selected.has(l.id));
    downloadCsv(
      "nexora-лиды.csv",
      ["Имя", "Компания", "Телефон", "Email", "Источник", "Статус", "Ответственный", "Сообщение", "Создан"],
      picked.map((l) => [
        l.name,
        l.company,
        l.phone,
        l.email,
        SOURCE_BY_ID[l.source].label,
        STATUS_LABEL[l.status],
        l.ownerId ? (members.get(l.ownerId)?.name ?? "") : "",
        l.message,
        l.createdAt.slice(0, 10),
      ]),
    );
    done("Выгрузили в CSV");
  };

  return (
    <div className="animate-page space-y-6">
      <PageHeader
        title="Лиды"
        description="Все заявки из мессенджеров, соцсетей и сайта в одной ленте"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <FileUp />
              <span className="hidden sm:inline">Импорт</span>
            </Button>
            <Button size="sm" onClick={() => openDialog("lead")}>
              <Plus />
              Добавить лида
            </Button>
          </>
        }
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            icon={Magnet}
            label="Лидов за 30 дней"
            value={formatNumber(recent.length)}
            hint={<Delta value={previous.length ? (recent.length - previous.length) / previous.length : null} />}
          />
          <StatTile
            icon={MessageCircleWarning}
            tone={late.length ? "critical" : "default"}
            label="Ждут ответа"
            value={formatNumber(waiting.length)}
            hint={late.length ? `${late.length} дольше ${LEAD_RESPONSE_SLA_MIN} минут` : "Все в пределах получаса"}
          />
          <StatTile
            icon={Clock3}
            label="Среднее время ответа"
            value={avgResponse !== null ? formatDuration(avgResponse) : "—"}
            hint={`Цель — до ${LEAD_RESPONSE_SLA_MIN} минут`}
          />
          <StatTile
            icon={Target}
            tone="success"
            label="Стали сделками"
            value={recent.length ? formatPercent(converted / recent.length) : "—"}
            hint={`${converted} из ${recent.length} за 30 дней`}
          />
        </div>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Источники за 30 дней</CardTitle>
              <CardDescription>Доля заявок по каналам. Нажмите на канал, чтобы показать только его лидов</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ShareBar
              active={source === "all" ? null : source}
              onSelect={(key) => setSource((key as LeadSource | null) ?? "all")}
              items={[...sources]
                .sort((a, b) => b.leads - a.leads)
                .map((s) => ({
                  key: s.source,
                  name: SOURCE_BY_ID[s.source].label,
                  label: <SourceLabel source={s.source} />,
                  value: s.leads,
                  color: SOURCE_BY_ID[s.source].color,
                  display: formatPercent(s.share),
                  secondary: formatCount(s.leads, ["лид", "лида", "лидов"]),
                }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <ViewsBar
          entity="leads"
          primaryKey="status"
          filters={{ status, source, owner, query }}
          defaults={DEFAULT_FILTERS}
          builtins={[
            { id: "all", name: "Все", value: "all", count: counts.all },
            { id: "new", name: "Новые", value: "new", count: counts.new },
            { id: "contacted", name: "В работе", value: "contacted", count: counts.contacted },
            { id: "qualified", name: "Квалифицированы", value: "qualified", count: counts.qualified },
            { id: "converted", name: "Сделки", value: "converted", count: counts.converted },
            { id: "disqualified", name: "Отказы", value: "disqualified", count: counts.disqualified },
          ]}
          onApply={(f) => {
            setStatus((f.status ?? "all") as StatusTab);
            setSource((f.source ?? "all") as LeadSource | "all");
            setOwner(f.owner ?? "all");
            setQuery(f.query ?? "");
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Имя, компания, телефон" className="w-full sm:w-64" />
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
          <Select value={owner} onValueChange={(v: ID | "all") => setOwner(v)}>
            <SelectTrigger size="sm" className="w-auto min-w-[168px]" aria-label="Ответственный">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все ответственные</SelectItem>
              {[...members.values()].map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <UserAvatar name={m.name} hue={m.hue} size="xs" />
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Segmented
            size="sm"
            className="sm:ml-auto"
            value={view}
            onValueChange={setView}
            options={[
              { value: "cards", label: "Карточки", icon: LayoutGrid },
              { value: "table", label: "Таблица", icon: Rows3 },
            ]}
            aria-label="Вид"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card shadow-card">
          <EmptyState
            icon={Magnet}
            title={leads.length ? "Под фильтр ничего не попало" : "Пока нет лидов"}
            description={
              leads.length
                ? "Сбросьте фильтры или поищите по-другому."
                : "Подключите Telegram, WhatsApp, MAX или форму на сайте — заявки будут появляться здесь сами."
            }
            action={
              <Button size="sm" onClick={() => openDialog("lead")}>
                <Plus />
                Добавить лида
              </Button>
            }
          />
        </div>
      ) : view === "cards" ? (
        <div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pager.slice.map((lead) => (
              <LeadCard key={lead.id} lead={lead} owner={lead.ownerId ? members.get(lead.ownerId) : undefined} now={now} />
            ))}
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border bg-card">
            <Pagination page={pager.page} pages={pager.pages} total={pager.total} size={pager.size} onPage={pager.setPage} onSize={pager.setSize} noun="лидов" />
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-[13px]">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="w-10 pl-4">
                    <SelectAllCheckbox selection={selection} />
                  </th>
                  <Th className="pl-1">Лид</Th>
                  <Th>Источник</Th>
                  <Th>Статус</Th>
                  <Th>Ответственный</Th>
                  <Th>Создан</Th>
                  <Th>Скорость ответа</Th>
                  <Th className="pr-4 text-right">Действие</Th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((lead) => {
                  const owner = lead.ownerId ? members.get(lead.ownerId) : undefined;
                  return (
                    <tr
                      key={lead.id}
                      className={cn("border-b transition-colors last:border-0 hover:bg-accent/40", selection.selected.has(lead.id) && "bg-primary-soft/40 hover:bg-primary-soft/60")}
                    >
                      <td className="py-2.5 pl-4">
                        <RowCheckbox selection={selection} id={lead.id} label={`Выбрать «${lead.name}»`} />
                      </td>
                      <td className="py-2.5 pl-1 pr-3">
                        <span className="flex items-center gap-2.5">
                          <UserAvatar name={lead.name} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{lead.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{lead.company || "Частное лицо"}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <SourceLabel source={lead.source} />
                      </td>
                      <td className="px-3 py-2.5">
                        <LeadStatusBadge status={lead.status} />
                      </td>
                      <td className="px-3 py-2.5">{owner?.name ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{formatRelative(lead.createdAt, now)}</td>
                      <td className="px-3 py-2.5">
                        <ResponseChip lead={lead} now={now} />
                      </td>
                      <td className="py-2.5 pl-3 pr-4">
                        <span className="flex items-center justify-end gap-1">
                          <LeadPrimaryAction lead={lead} />
                          <LeadMenu lead={lead} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={pager.page} pages={pager.pages} total={pager.total} size={pager.size} onPage={pager.setPage} onSize={pager.setSize} noun="лидов" />
        </div>
      )}

      <BulkBar selection={selection} noun={["лид", "лида", "лидов"]}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <UserRound />
              Ответственный
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="w-56">
            {[...members.values()].map((m) => (
              <DropdownMenuItem
                key={m.id}
                onSelect={() => {
                  bulkUpdateLeads(selection.ids, { ownerId: m.id });
                  done(`Передали: ${m.name}`);
                }}
              >
                <UserAvatar name={m.name} hue={m.hue} size="xs" />
                {m.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            bulkUpdateLeads(selection.ids, { status: "contacted" });
            done("Взяли в работу");
          }}
        >
          <MessagesSquare />
          <span className="hidden sm:inline">В работу</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            bulkUpdateLeads(selection.ids, { status: "disqualified" });
            done("Отметили отказом");
          }}
        >
          <CircleSlash />
          <span className="hidden sm:inline">Отказ</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={exportSelected}>
          <Download />
          <span className="hidden sm:inline">CSV</span>
        </Button>
        <Button variant="ghost" size="sm" className="text-critical-text hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
          <Trash2 />
          <span className="hidden sm:inline">Удалить</span>
        </Button>
      </BulkBar>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Удалить ${formatCount(selection.count, ["лида", "лидов", "лидов"])}?`}
        description="Лиды удалятся без возможности восстановления. Сделки, созданные из них, останутся."
        confirmLabel="Удалить"
        onConfirm={() => {
          bulkDeleteLeads(selection.ids);
          done("Лиды удалены");
        }}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} entity="leads" />
    </div>
  );
}
