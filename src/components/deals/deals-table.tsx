"use client";

import * as React from "react";
import { Download, Flag, SquareKanban, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import type { Client, Deal, ID, Member } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BulkBar, RowCheckbox, SelectAllCheckbox, useSelection } from "@/components/common/bulk";
import { PriorityIcon, PriorityLabel, StageBadge, StageDot } from "@/components/common/entity-meta";
import { EmptyState } from "@/components/common/states";
import { Pagination, SortHeader, compareBy, usePagination, useSort, type SortState } from "@/components/common/table-parts";
import { UserAvatar } from "@/components/common/user-avatar";
import { useCrm, useLostReasons } from "@/hooks/use-crm";
import { PRIORITIES, STAGES } from "@/lib/constants";
import { downloadCsv } from "@/lib/export";
import { stageLabel, stageList } from "@/lib/stages";
import { accountName } from "@/lib/display";
import { formatCount, formatDate, formatMoney, formatRelativeShort } from "@/lib/format";
import { useUi } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

type Key = "title" | "stage" | "amount" | "owner" | "priority" | "activity" | "close";
const stageOrder = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));

export function DealsTable({
  deals,
  clients,
  members,
  now,
  resetKey,
}: {
  deals: Deal[];
  clients: Map<ID, Client>;
  members: Map<ID, Member>;
  now: number;
  resetKey: unknown;
}) {
  const openDeal = useUi((s) => s.openDeal);
  const [sort, onSort] = useSort<Key>({ key: "activity", dir: "desc" });

  const sorted = React.useMemo(() => {
    const pick: Record<Key, (d: Deal) => string | number> = {
      title: (d) => d.title,
      stage: (d) => stageOrder[d.stage] ?? 0,
      amount: (d) => d.amount,
      owner: (d) => members.get(d.ownerId)?.name ?? "",
      priority: (d) => PRIORITIES[d.priority].rank,
      activity: (d) => Date.parse(d.lastActivityAt),
      close: (d) => Date.parse(d.closedAt ?? d.expectedCloseAt),
    };
    return [...deals].sort(compareBy(pick[sort.key], sort.dir));
  }, [deals, sort, members]);

  const pager = usePagination(sorted, 20, [resetKey, sort]);
  const selection = useSelection(pager.slice.map((d) => d.id));
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const lostReasons = useLostReasons();
  const { bulkUpdateDeals, bulkMoveDeals, bulkDeleteDeals } = useCrm.getState();
  const done = (text: string) => {
    toast.success(text, { description: `Сделок: ${selection.count}` });
    selection.clear();
  };
  const exportSelected = () => {
    const rows = deals.filter((d) => selection.selected.has(d.id));
    downloadCsv(
      "nexora-сделки.csv",
      ["Сделка", "Клиент", "Этап", "Сумма", "Ответственный", "Приоритет", "Создана"],
      rows.map((d) => [d.title, accountName(clients.get(d.clientId)), stageLabel(d.stage), d.amount, members.get(d.ownerId)?.name ?? "", PRIORITIES[d.priority].label, d.createdAt.slice(0, 10)]),
    );
    done("Выгрузили в CSV");
  };
  const header = (label: string, column: Key, extra?: { align?: "right"; className?: string }) => (
    <SortHeader<Key> label={label} column={column} sort={sort as SortState<Key>} onSort={onSort} {...extra} />
  );

  if (!deals.length) {
    return (
      <div className="rounded-xl border bg-card shadow-card">
        <EmptyState icon={SquareKanban} title="Сделок не найдено" description="Измените фильтры или создайте новую сделку." />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-[13px]">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="w-10 pl-4">
                <SelectAllCheckbox selection={selection} />
              </th>
              {header("Сделка", "title", { className: "pl-1" })}
              {header("Этап", "stage")}
              {header("Сумма", "amount", { align: "right" })}
              {header("Ответственный", "owner")}
              {header("Приоритет", "priority")}
              {header("Активность", "activity")}
              {header("Закрытие", "close", { className: "pr-4" })}
            </tr>
          </thead>
          <tbody>
            {pager.slice.map((deal) => {
              const client = clients.get(deal.clientId);
              const owner = members.get(deal.ownerId);
              const overdue = !deal.closedAt && Date.parse(deal.expectedCloseAt) < now;
              return (
                <tr
                  key={deal.id}
                  onClick={() => openDeal(deal.id)}
                  className={cn("cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/50", selection.selected.has(deal.id) && "bg-primary-soft/40 hover:bg-primary-soft/60")}
                >
                  <td className="w-10 py-3 pl-4">
                    <RowCheckbox selection={selection} id={deal.id} label={`Выбрать «${deal.title}»`} />
                  </td>
                  <td className="max-w-[320px] py-3 pl-1 pr-3">
                    <button type="button" className="block max-w-full text-left outline-none focus-visible:underline" onClick={() => openDeal(deal.id)}>
                      <span className="block truncate font-medium">{deal.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{accountName(client)}</span>
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <StageBadge stage={deal.stage} />
                  </td>
                  <td className="tabular px-3 py-3 text-right font-semibold">{formatMoney(deal.amount)}</td>
                  <td className="px-3 py-3">
                    {owner && (
                      <span className="flex items-center gap-2">
                        <UserAvatar name={owner.name} hue={owner.hue} size="sm" />
                        <span className="truncate">{owner.name}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <PriorityLabel priority={deal.priority} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{formatRelativeShort(deal.lastActivityAt, now)} назад</td>
                  <td className={cn("whitespace-nowrap py-3 pl-3 pr-4", overdue ? "font-medium text-critical-text" : "text-muted-foreground")}>
                    {formatDate(deal.closedAt ?? deal.expectedCloseAt, now)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        page={pager.page}
        pages={pager.pages}
        total={pager.total}
        size={pager.size}
        onPage={pager.setPage}
        onSize={pager.setSize}
        noun="сделок"
      />

      <BulkBar selection={selection} noun={["сделка", "сделки", "сделок"]}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <SquareKanban />
              Этап
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="w-56">
            {stageList()
              .filter((s) => s.id !== "lost")
              .map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onSelect={() => {
                    bulkMoveDeals(selection.ids, s.id);
                    done(`Перенесли в «${s.label}»`);
                  }}
                >
                  <StageDot stage={s.id} />
                  {s.label}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <StageDot stage="lost" />
                {stageLabel("lost")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {lostReasons.map((reason) => (
                  <DropdownMenuItem
                    key={reason}
                    onSelect={() => {
                      bulkMoveDeals(selection.ids, "lost", reason);
                      done(`Отметили проигранными: ${reason.toLowerCase()}`);
                    }}
                  >
                    {reason}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
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
                  bulkUpdateDeals(selection.ids, { ownerId: m.id });
                  done(`Передали: ${m.name}`);
                }}
              >
                <UserAvatar name={m.name} hue={m.hue} size="xs" />
                {m.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Flag />
              Приоритет
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center">
            {(["high", "medium", "low"] as const).map((p) => (
              <DropdownMenuItem
                key={p}
                onSelect={() => {
                  bulkUpdateDeals(selection.ids, { priority: p });
                  done(`Приоритет: ${PRIORITIES[p].label.toLowerCase()}`);
                }}
              >
                <PriorityIcon priority={p} />
                {PRIORITIES[p].label}
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
        title={`Удалить ${formatCount(selection.count, ["сделку", "сделки", "сделок"])}?`}
        description="Сделки и их документы удалятся без возможности восстановления. Задачи останутся, но потеряют связь со сделками."
        confirmLabel="Удалить"
        onConfirm={() => {
          bulkDeleteDeals(selection.ids);
          done("Сделки удалены");
        }}
      />
    </div>
  );
}
