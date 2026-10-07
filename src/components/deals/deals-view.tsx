"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Columns3, Plus, Rows3 } from "lucide-react";
import type { ID, Priority } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { PageSkeleton } from "@/components/common/skeletons";
import { SearchInput } from "@/components/common/table-parts";
import { ViewsBar } from "@/components/common/views-bar";
import { PriorityIcon } from "@/components/common/entity-meta";
import { UserAvatar } from "@/components/common/user-avatar";
import { useClientMap, useCrm, useMemberMap, useNow, useReady } from "@/hooks/use-crm";
import { PRIORITIES, STALE_DEAL_DAYS } from "@/lib/constants";
import { formatMoneyCompact, formatNumber } from "@/lib/format";
import { forecast, isOpen } from "@/lib/metrics";
import { useUi } from "@/lib/store/ui-store";
import { DAY } from "@/lib/time";
import { matchesQuery, plural } from "@/lib/utils";
import { DealsTable } from "./deals-table";
import { KanbanBoard } from "./kanban-board";

type View = "board" | "table";
type Focus = "all" | "mine" | "stale" | "overdue";
type Status = "open" | "won" | "lost" | "all";

const DEFAULT_FILTERS = { focus: "all", owner: "all", priority: "all", query: "" };

export function DealsView() {
  const ready = useReady();
  if (!ready) return <PageSkeleton variant="board" />;
  return <Deals />;
}

function Deals() {
  const params = useSearchParams();
  const router = useRouter();
  const openDeal = useUi((s) => s.openDeal);
  const openDialog = useUi((s) => s.openDialog);
  const deals = useCrm((s) => s.deals);
  const me = useCrm((s) => s.currentUserId);
  const members = useMemberMap();
  const clients = useClientMap();
  const now = useNow();

  const [view, setView] = React.useState<View>("board");
  const [query, setQuery] = React.useState("");
  const [owner, setOwner] = React.useState<ID | "all">("all");
  const [priority, setPriority] = React.useState<Priority | "all">("all");
  const [focus, setFocus] = React.useState<Focus>(() => {
    const f = params.get("focus");
    return f === "stale" || f === "overdue" ? f : "all";
  });
  const [status, setStatus] = React.useState<Status>("open");

  // ?deal=… открывает карточку сделки (ссылки из уведомлений и поиска)
  React.useEffect(() => {
    const id = params.get("deal");
    if (id) {
      openDeal(id);
      router.replace("/deals", { scroll: false });
    }
  }, [params, openDeal, router]);

  const filtered = React.useMemo(() => {
    const recentClosed = now - 30 * DAY;
    return deals.filter((d) => {
      const client = clients.get(d.clientId);
      if (!matchesQuery(query, d.title, client?.company, client?.name)) return false;
      if (owner !== "all" && d.ownerId !== owner) return false;
      if (priority !== "all" && d.priority !== priority) return false;
      if (focus === "mine" && d.ownerId !== me) return false;
      if (focus === "stale" && !(isOpen(d) && now - Date.parse(d.lastActivityAt) > STALE_DEAL_DAYS * DAY)) return false;
      if (focus === "overdue" && !(isOpen(d) && Date.parse(d.expectedCloseAt) < now)) return false;
      if (view === "board") return isOpen(d) || (d.closedAt !== null && Date.parse(d.closedAt) >= recentClosed);
      if (status === "open") return isOpen(d);
      if (status === "won" || status === "lost") return d.stage === status;
      return true;
    });
  }, [deals, clients, query, owner, priority, focus, me, now, view, status]);

  const openDeals = deals.filter(isOpen);
  const pipeline = openDeals.reduce((acc, d) => acc + d.amount, 0);

  return (
    <div className="animate-page space-y-5">
      <PageHeader
        title="Сделки"
        description={`${formatNumber(openDeals.length)} ${plural(openDeals.length, ["сделка", "сделки", "сделок"])} в работе на ${formatMoneyCompact(pipeline)}, взвешенный прогноз ${formatMoneyCompact(forecast(deals))}`}
        actions={
          <>
            <Segmented
              value={view}
              onValueChange={setView}
              options={[
                { value: "board", label: "Канбан", icon: Columns3 },
                { value: "table", label: "Таблица", icon: Rows3 },
              ]}
              aria-label="Вид"
            />
            <Button size="sm" onClick={() => openDialog("deal")}>
              <Plus />
              Новая сделка
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Сделка или клиент" className="w-full sm:w-64" />
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
        <Select value={priority} onValueChange={(v: Priority | "all") => setPriority(v)}>
          <SelectTrigger size="sm" className="w-auto min-w-[150px]" aria-label="Приоритет">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Любой приоритет</SelectItem>
            {(["high", "medium", "low"] as const).map((p) => (
              <SelectItem key={p} value={p}>
                <PriorityIcon priority={p} />
                {PRIORITIES[p].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ViewsBar
          entity="deals"
          primaryKey="focus"
          filters={{ focus, owner, priority, query }}
          defaults={DEFAULT_FILTERS}
          onApply={(f) => {
            setFocus((f.focus ?? "all") as Focus);
            setOwner(f.owner ?? "all");
            setPriority((f.priority ?? "all") as Priority | "all");
            setQuery(f.query ?? "");
          }}
          builtins={[
            { id: "all", name: "Все", value: "all" },
            { id: "mine", name: "Мои", value: "mine" },
            { id: "stale", name: "Без движения", value: "stale" },
            { id: "overdue", name: "Срок прошёл", value: "overdue" },
          ]}
        />
        {view === "table" && (
          <Segmented
            size="sm"
            className="sm:ml-auto"
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "open", label: "Открытые" },
              { value: "won", label: "Выигранные" },
              { value: "lost", label: "Проигранные" },
              { value: "all", label: "Все" },
            ]}
            aria-label="Статус"
          />
        )}
      </div>

      {view === "board" ? (
        <KanbanBoard deals={filtered} clients={clients} members={members} now={now} />
      ) : (
        <DealsTable deals={filtered} clients={clients} members={members} now={now} resetKey={[query, owner, priority, focus, status]} />
      )}
    </div>
  );
}
