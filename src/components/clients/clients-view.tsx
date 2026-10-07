"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileUp, Plus, Trash2, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import type { ClientStatus, ID } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BulkBar, RowCheckbox, SelectAllCheckbox, useSelection } from "@/components/common/bulk";
import { CopyButton } from "@/components/common/copy-button";
import { ViewsBar } from "@/components/common/views-bar";
import { ImportDialog } from "@/components/import/import-wizard";
import { ClientStatusBadge } from "@/components/common/entity-meta";
import { PageHeader } from "@/components/common/page-header";
import { PageSkeleton } from "@/components/common/skeletons";
import { EmptyState } from "@/components/common/states";
import { Pagination, SearchInput, SortHeader, Th, compareBy, usePagination, useSort } from "@/components/common/table-parts";
import { UserAvatar } from "@/components/common/user-avatar";
import { useCrm, useMemberMap, useNow, useReady } from "@/hooks/use-crm";
import { downloadCsv } from "@/lib/export";
import { formatCount, formatMoney, formatNumber, formatRelative } from "@/lib/format";
import { clientStatsMap, clientStatus, statsFor } from "@/lib/metrics";
import { useUi } from "@/lib/store/ui-store";
import { cn, matchesQuery, plural } from "@/lib/utils";

type Key = "name" | "company" | "activity" | "deals" | "revenue";
const DEFAULT_FILTERS = { status: "all", owner: "all", query: "" };
const STATUS_LABEL: Record<ClientStatus, string> = { new: "Новый", active: "Активный", vip: "Ключевой", inactive: "Неактивный" };

export function ClientsView() {
  const ready = useReady();
  if (!ready) return <PageSkeleton variant="table" />;
  return <Clients />;
}

function Clients() {
  const clients = useCrm((s) => s.clients);
  const deals = useCrm((s) => s.deals);
  const members = useMemberMap();
  const openDialog = useUi((s) => s.openDialog);
  const router = useRouter();
  const now = useNow();

  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<ClientStatus | "all">("all");
  const [owner, setOwner] = React.useState<ID | "all">("all");
  const [sort, onSort] = useSort<Key>({ key: "activity", dir: "desc" });
  const [importOpen, setImportOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const stats = React.useMemo(() => clientStatsMap(deals), [deals]);
  const rows = React.useMemo(
    () =>
      clients.map((client) => {
        const s = statsFor(stats, client.id);
        return { client, stats: s, status: clientStatus(client, s, now) };
      }),
    [clients, stats, now],
  );

  const counts = React.useMemo(() => {
    const c = { all: rows.length, new: 0, active: 0, vip: 0, inactive: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  const filtered = React.useMemo(() => {
    const pick: Record<Key, (r: (typeof rows)[number]) => string | number> = {
      name: (r) => r.client.name,
      company: (r) => r.client.company,
      activity: (r) => Date.parse(r.client.lastActivityAt),
      deals: (r) => r.stats.deals,
      revenue: (r) => r.stats.revenue,
    };
    return rows
      .filter(
        (r) =>
          (status === "all" || r.status === status) &&
          (owner === "all" || r.client.ownerId === owner) &&
          matchesQuery(query, r.client.name, r.client.company, r.client.email, r.client.phone, r.client.city),
      )
      .sort(compareBy(pick[sort.key], sort.dir));
  }, [rows, status, owner, query, sort]);

  const pager = usePagination(filtered, 20, [status, owner, query, sort]);
  const selection = useSelection(pager.slice.map((r) => r.client.id));
  const { bulkUpdateClients, bulkDeleteClients } = useCrm.getState();
  const done = (text: string) => {
    toast.success(text, { description: `Клиентов: ${selection.count}` });
    selection.clear();
  };
  const exportSelected = () => {
    const picked = filtered.filter((r) => selection.selected.has(r.client.id));
    downloadCsv(
      "nexora-клиенты.csv",
      ["Имя", "Компания", "Телефон", "Email", "Город", "Ответственный", "Сделок", "Выручка", "Статус"],
      picked.map(({ client, stats: st, status: cs }) => [
        client.name,
        client.company,
        client.phone,
        client.email,
        client.city,
        members.get(client.ownerId)?.name ?? "",
        st.deals,
        st.revenue,
        STATUS_LABEL[cs],
      ]),
    );
    done("Выгрузили в CSV");
  };

  return (
    <div className="animate-page space-y-5">
      <PageHeader
        title="Клиенты"
        description={`${formatNumber(rows.length)} ${plural(rows.length, ["клиент", "клиента", "клиентов"])}, из них ${formatNumber(counts.active + counts.vip + counts.new)} активных`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <FileUp />
              <span className="hidden sm:inline">Импорт</span>
            </Button>
            <Button size="sm" onClick={() => openDialog("client")}>
              <Plus />
              Добавить клиента
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Имя, компания, телефон, email" className="w-full sm:w-72" />
        <ViewsBar
          entity="clients"
          primaryKey="status"
          filters={{ status, owner, query }}
          defaults={DEFAULT_FILTERS}
          builtins={[
            { id: "all", name: "Все", value: "all", count: counts.all },
            { id: "new", name: "Новые", value: "new", count: counts.new },
            { id: "active", name: "Активные", value: "active", count: counts.active },
            { id: "vip", name: "Ключевые", value: "vip", count: counts.vip },
            { id: "inactive", name: "Неактивные", value: "inactive", count: counts.inactive },
          ]}
          onApply={(f) => {
            setStatus((f.status ?? "all") as ClientStatus | "all");
            setOwner(f.owner ?? "all");
            setQuery(f.query ?? "");
          }}
        />
        <Select value={owner} onValueChange={(v: ID | "all") => setOwner(v)}>
          <SelectTrigger size="sm" className="w-auto min-w-[168px] sm:ml-auto" aria-label="Ответственный">
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
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={clients.length ? "Никого не нашли" : "Пока нет клиентов"}
            description={clients.length ? "Проверьте написание или сбросьте фильтры." : "Добавьте первого клиента или конвертируйте лида в сделку."}
            action={
              <Button size="sm" onClick={() => openDialog("client")}>
                <Plus />
                Добавить клиента
              </Button>
            }
          />
        ) : (
          <>
            {/* телефон: карточки вместо широкой таблицы */}
            <ul className="divide-y md:hidden">
              {pager.slice.map(({ client, stats: s, status: st }) => (
                <li key={client.id}>
                  <Link href={`/clients/${client.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-accent">
                    <UserAvatar name={client.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{client.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{client.company || "Частное лицо"}</span>
                    </span>
                    <span className="text-right">
                      <span className={cn("tabular block text-[13px]", s.revenue ? "font-semibold" : "text-muted-foreground")}>{s.revenue ? formatMoney(s.revenue) : "—"}</span>
                      <ClientStatusBadge status={st} className="mt-1 h-5 px-2 text-[11px]" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              {/*
                table-fixed: ширины задаются в шапке, длинные значения обрезаются, а не раздвигают таблицу.
                На экранах уже 1536px email переезжает под имя, чтобы все колонки помещались без прокрутки.
              */}
              <table className="w-full min-w-[920px] table-fixed text-[13px]">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="w-10 pl-4">
                      <SelectAllCheckbox selection={selection} />
                    </th>
                    <SortHeader<Key> label="Имя" column="name" sort={sort} onSort={onSort} className="w-[25%] pl-1 2xl:w-[19%]" />
                    <SortHeader<Key> label="Компания" column="company" sort={sort} onSort={onSort} />
                    <Th className="w-[188px]">Телефон</Th>
                    <Th className="hidden 2xl:table-cell">Email</Th>
                    <SortHeader<Key> label="Активность" title="Последняя активность" column="activity" sort={sort} onSort={onSort} className="w-[124px]" />
                    <SortHeader<Key> label="Сделок" title="Количество сделок" column="deals" sort={sort} onSort={onSort} align="right" className="w-[84px]" />
                    <SortHeader<Key> label="Общая сумма" title="Сумма успешных сделок" column="revenue" sort={sort} onSort={onSort} align="right" className="w-[124px]" />
                    <Th className="w-[136px] pl-5 pr-4">Статус</Th>
                  </tr>
                </thead>
                <tbody>
                  {pager.slice.map(({ client, stats: s, status: st }) => (
                    <tr
                      key={client.id}
                      onClick={() => router.push(`/clients/${client.id}`)}
                      className={cn(
                        "group cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/45",
                        selection.selected.has(client.id) && "bg-primary-soft/40 hover:bg-primary-soft/60",
                      )}
                    >
                      <td className="py-2 pl-4">
                        <RowCheckbox selection={selection} id={client.id} label={`Выбрать «${client.name}»`} />
                      </td>
                      <td className="py-2 pl-1 pr-3">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <UserAvatar name={client.name} size="sm" />
                          <span className="min-w-0">
                            <Link
                              href={`/clients/${client.id}`}
                              onClick={(e) => e.stopPropagation()}
                              title={client.name}
                              className="block truncate font-medium outline-none focus-visible:underline"
                            >
                              {client.name}
                            </Link>
                            <span className="block truncate text-xs text-muted-foreground 2xl:hidden" title={client.email}>
                              {client.email}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="truncate px-3 py-2" title={client.company}>
                        {client.company || <span className="text-muted-foreground">Частное лицо</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex min-w-0 items-center gap-1">
                          <span className="tabular truncate">{client.phone}</span>
                          <CopyButton value={client.phone} label="Скопировать телефон" className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" />
                        </span>
                      </td>
                      <td className="hidden px-3 py-2 2xl:table-cell">
                        <span className="flex min-w-0 items-center gap-1">
                          <span className="truncate text-muted-foreground" title={client.email}>
                            {client.email}
                          </span>
                          <CopyButton value={client.email} label="Скопировать email" className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" />
                        </span>
                      </td>
                      <td className="truncate px-3 py-2 text-muted-foreground">{formatRelative(client.lastActivityAt, now)}</td>
                      <td className="tabular px-3 py-2 text-right">{s.deals}</td>
                      <td className={cn("tabular truncate px-3 py-2 text-right", s.revenue ? "font-semibold" : "text-muted-foreground")}>
                        {s.revenue ? formatMoney(s.revenue) : "—"}
                      </td>
                      <td className="py-2 pl-5 pr-4">
                        <ClientStatusBadge status={st} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={pager.page} pages={pager.pages} total={pager.total} size={pager.size} onPage={pager.setPage} onSize={pager.setSize} noun="клиентов" />
          </>
        )}
      </div>

      <BulkBar selection={selection} noun={["клиент", "клиента", "клиентов"]}>
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
                  bulkUpdateClients(selection.ids, { ownerId: m.id });
                  done(`Передали: ${m.name}`);
                }}
              >
                <UserAvatar name={m.name} hue={m.hue} size="xs" />
                {m.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
        title={`Удалить ${formatCount(selection.count, ["клиента", "клиентов", "клиентов"])}?`}
        description="Вместе с клиентами удалятся их сделки, задачи, заметки и документы. Переписка останется во «Входящих»."
        confirmLabel="Удалить"
        onConfirm={() => {
          bulkDeleteClients(selection.ids);
          done("Клиенты удалены");
        }}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} entity="clients" />
    </div>
  );
}
