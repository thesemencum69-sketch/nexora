"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, CalendarDays, Check, ChevronDown, CircleCheck, CircleX, Clock, FileText, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import type { Deal, Priority } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { ActivityFeed } from "@/components/common/activity-feed";
import { PriorityIcon, SourceLabel, StageBadge } from "@/components/common/entity-meta";
import { EmptyState } from "@/components/common/states";
import { UserAvatar } from "@/components/common/user-avatar";
import { AddFieldButton, CustomFieldRows } from "@/components/fields/custom-fields";
import { MemberSelect, fromInputs, toDateInput } from "@/components/forms/form-controls";
import { DealDocuments } from "@/components/documents/deal-documents";
import { useDocumentActions } from "@/components/documents/use-document-actions";
import { ChatThread } from "@/components/inbox/chat-thread";
import { useDealConversation } from "@/components/inbox/use-inbox";
import { TaskRow } from "@/components/tasks/task-row";
import { OPEN_STAGES, PRIORITIES, STAGE_BY_ID } from "@/lib/constants";
import { stageLabel, stageProbability } from "@/lib/stages";
import { useCrm, useMemberMap, useNow } from "@/hooks/use-crm";
import { formatDate, formatMoney, formatRelative } from "@/lib/format";
import { useUi } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { DealItems } from "./deal-items";
import { LostReasonDialog } from "./lost-reason-dialog";
import { useDealActions } from "./use-deal-actions";

function Property({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[132px_minmax(0,1fr)] items-center gap-3 py-1.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div className="min-w-0 text-[13px]">{children}</div>
    </div>
  );
}

function StageStepper({ deal }: { deal: Deal }) {
  const { move } = useDealActions();
  const currentIndex = OPEN_STAGES.indexOf(deal.stage as (typeof OPEN_STAGES)[number]);
  const closed = deal.stage === "won" || deal.stage === "lost";
  return (
    <div className="space-y-2.5">
      <div className="no-scrollbar flex gap-1 overflow-x-auto" role="group" aria-label="Этап сделки">
        {OPEN_STAGES.map((stage, index) => {
          const passed = closed ? deal.stageReached > index || deal.stage === "won" : index < currentIndex;
          const current = stage === deal.stage;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => move(deal, stage)}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex h-8 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                current
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : passed
                    ? "bg-primary-soft text-primary hover:bg-primary/15"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {passed && !current && <Check className="size-3.5 shrink-0" strokeWidth={2.5} />}
              <span className="truncate">{stageLabel(stage)}</span>
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className={cn("flex-1", deal.stage === "won" && "border-success/40 bg-success/10 text-success-text")}
          onClick={() => move(deal, "won")}
        >
          <CircleCheck className="text-success-text" />
          {deal.stage === "won" ? "Выиграна" : "Отметить выигранной"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={cn("flex-1", deal.stage === "lost" && "border-destructive/30 bg-destructive/8 text-critical-text")}
          onClick={() => move(deal, "lost")}
        >
          <CircleX className="text-critical-text" />
          {deal.stage === "lost" ? "Проиграна" : "Проиграна"}
        </Button>
      </div>
    </div>
  );
}

function NotesPanel({ deal }: { deal: Deal }) {
  const notes = useCrm((s) => s.notes);
  const addNote = useCrm((s) => s.addNote);
  const members = useMemberMap();
  const now = useNow();
  const [body, setBody] = React.useState("");
  const list = notes.filter((n) => n.dealId === deal.id);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    addNote({ body: body.trim(), dealId: deal.id, clientId: deal.clientId });
    setBody("");
    toast.success("Комментарий добавлен");
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Договорённости, детали, следующий шаг…"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">⌘ + Enter — отправить</span>
          <Button type="submit" size="sm" disabled={!body.trim()}>
            Добавить
          </Button>
        </div>
      </form>
      {list.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Заметок пока нет</p>
      ) : (
        <ul className="space-y-3">
          {list.map((note) => {
            const author = members.get(note.authorId);
            return (
              <li key={note.id} className="flex gap-3">
                <UserAvatar name={author?.name ?? "?"} hue={author?.hue} size="sm" className="mt-0.5" />
                <div className="min-w-0 flex-1 rounded-lg bg-muted/60 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{author?.name}</span>
                    {formatRelative(note.createdAt, now)}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">{note.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DealDetails({ deal }: { deal: Deal }) {
  const client = useCrm((s) => s.clients.find((c) => c.id === deal.clientId));
  const tasks = useCrm((s) => s.tasks);
  const activities = useCrm((s) => s.activities);
  const updateDeal = useCrm((s) => s.updateDeal);
  const deleteDeal = useCrm((s) => s.deleteDeal);
  const documentsCount = useCrm((s) => s.documents.filter((d) => d.dealId === deal.id && d.status !== "canceled").length);
  const conversation = useDealConversation(deal.id, deal.leadId, deal.clientId);
  const { closeDeal, openDialog } = useUi.getState();
  const { create } = useDocumentActions();
  const now = useNow();
  const hasItems = Boolean(deal.items?.length);
  const [title, setTitle] = React.useState(deal.title);
  const [amount, setAmount] = React.useState(String(deal.amount));
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    setTitle(deal.title);
    setAmount(String(deal.amount));
  }, [deal.id, deal.title, deal.amount]);

  const dealTasks = tasks.filter((t) => t.dealId === deal.id).sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.dueAt.localeCompare(b.dueAt));
  const dealActivities = activities.filter((a) => a.dealId === deal.id).slice(0, 30);
  const openCount = dealTasks.filter((t) => t.status === "open").length;
  const daysIdle = Math.floor((now - Date.parse(deal.lastActivityAt)) / 86_400_000);

  const saveTitle = () => {
    const next = title.trim();
    if (next && next !== deal.title) {
      updateDeal(deal.id, { title: next });
      toast.success("Название обновлено");
    } else setTitle(deal.title);
  };
  const saveAmount = () => {
    const next = Number(amount.replace(/\s/g, ""));
    if (Number.isFinite(next) && next >= 0 && next !== deal.amount) {
      updateDeal(deal.id, { amount: next });
      toast.success("Сумма обновлена", { description: formatMoney(next) });
    } else setAmount(String(deal.amount));
  };

  return (
    <>
      <div className="border-b px-6 pb-5 pt-5">
        <div className="flex items-center gap-2 pr-8">
          <StageBadge stage={deal.stage} />
          <span className="text-xs text-muted-foreground">Создана {formatDate(deal.createdAt, now)}</span>
        </div>
        <SheetTitle asChild>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            aria-label="Название сделки"
            className="mt-3 w-full rounded-md bg-transparent text-xl font-semibold tracking-[-0.02em] outline-none ring-ring/30 transition-shadow hover:bg-accent/50 focus:bg-card focus:ring-2"
          />
        </SheetTitle>
        <SheetDescription asChild>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            {client && (
              <Link href={`/clients/${client.id}`} onClick={closeDeal} className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline">
                {client.company ? <Building2 className="size-3.5 text-muted-foreground" /> : <UserRound className="size-3.5 text-muted-foreground" />}
                {client.company || client.name}
              </Link>
            )}
            {client?.company && <span className="text-muted-foreground">{client.name}</span>}
          </div>
        </SheetDescription>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="sr-only" htmlFor="deal-amount-inline">
            Сумма сделки
          </label>
          <div className="flex items-baseline">
            <input
              id="deal-amount-inline"
              inputMode="numeric"
              value={amount === "" ? "" : Number(amount.replace(/\s/g, "") || 0).toLocaleString("ru-RU")}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={saveAmount}
              readOnly={hasItems}
              title={hasItems ? "Сумма считается по товарам и услугам" : undefined}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              // ширина по содержимому: цифры по 1ch, разделители разрядов уже
              style={{ width: `${Math.max(1, String(Number(amount || 0)).length) + Math.floor((Math.max(1, String(Number(amount || 0)).length) - 1) / 3) * 0.4 + 0.4}ch` }}
              className="tabular rounded-md bg-transparent text-[28px] font-semibold tracking-[-0.03em] outline-none ring-ring/30 hover:bg-accent/50 focus:bg-card focus:ring-2"
            />
            <span className="ml-1 text-xl font-semibold text-muted-foreground">₽</span>
          </div>
          {!STAGE_BY_ID[deal.stage].closed && (
            <span className="mb-1.5 text-xs text-muted-foreground">
              Вероятность {Math.round(stageProbability(deal.stage) * 100)}%
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="mb-1 ml-auto">
                <FileText />
                Документ
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onSelect={() => create(deal.id, "invoice")}>
                <FileText />
                Счёт на оплату
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => create(deal.id, "proposal")}>
                <FileText />
                Коммерческое предложение
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <StageStepper deal={deal} />

        <section className="divide-y divide-border/0">
          <Property label="Ответственный">
            <MemberSelect value={deal.ownerId} onChange={(ownerId) => updateDeal(deal.id, { ownerId })} />
          </Property>
          <Property label="Приоритет">
            <Select value={deal.priority} onValueChange={(priority: Priority) => updateDeal(deal.id, { priority })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["high", "medium", "low"] as const).map((p) => (
                  <SelectItem key={p} value={p}>
                    <PriorityIcon priority={p} />
                    {PRIORITIES[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Property>
          <Property label="Дата закрытия">
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                className="pl-9"
                value={toDateInput(deal.expectedCloseAt)}
                onChange={(e) => e.target.value && updateDeal(deal.id, { expectedCloseAt: fromInputs(e.target.value, "18:00") })}
              />
            </div>
          </Property>
          <Property label="Источник">
            <SourceLabel source={deal.source} />
          </Property>
          <Property label="Последнее движение">
            <span className={cn("inline-flex items-center gap-1.5", daysIdle >= 7 && "font-medium text-warning-text")}>
              <Clock className="size-3.5" />
              {formatRelative(deal.lastActivityAt, now)}
            </span>
          </Property>
          {deal.lostReason && (
            <Property label="Причина отказа">
              <span className="text-critical-text">{deal.lostReason}</span>
            </Property>
          )}
          <CustomFieldRows entity="deal" entityId={deal.id} values={deal.custom} />
          <AddFieldButton entity="deal" className="-ml-2 mt-1" />
        </section>

        <DealItems deal={deal} />

        <Tabs defaultValue={conversation?.unread ? "chat" : "tasks"}>
          <TabsList className="w-full justify-start overflow-x-auto">
            {conversation && (
              <TabsTrigger value="chat">
                Переписка
                {conversation.unread > 0 && <span className="tabular rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{conversation.unread}</span>}
              </TabsTrigger>
            )}
            <TabsTrigger value="tasks">
              Задачи {openCount > 0 && <span className="tabular rounded-full bg-muted px-1.5 text-[11px]">{openCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="notes">Заметки</TabsTrigger>
            <TabsTrigger value="documents">
              Документы {documentsCount > 0 && <span className="tabular rounded-full bg-muted px-1.5 text-[11px]">{documentsCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="activity">История</TabsTrigger>
          </TabsList>
          {conversation && (
            <TabsContent value="chat" className="pt-3">
              <ChatThread conversation={conversation} compact className="h-[440px] overflow-hidden rounded-xl border" />
            </TabsContent>
          )}
          <TabsContent value="documents" className="pt-3">
            <DealDocuments deal={deal} />
          </TabsContent>
          <TabsContent value="tasks" className="pt-3">
            {dealTasks.length ? (
              <div className="-mx-2.5">
                {dealTasks.map((t) => (
                  <TaskRow key={t.id} task={t} now={now} compact />
                ))}
              </div>
            ) : (
              <EmptyState compact icon={Plus} title="Задач нет" description="Сделка без следующего шага — первый кандидат на потерю." />
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => openDialog("task", { dealId: deal.id, clientId: deal.clientId, ownerId: deal.ownerId })}
            >
              <Plus />
              Добавить задачу
            </Button>
          </TabsContent>
          <TabsContent value="notes" className="pt-4">
            <NotesPanel deal={deal} />
          </TabsContent>
          <TabsContent value="activity" className="pt-2">
            {dealActivities.length ? (
              <div className="-mx-2">
                <ActivityFeed activities={dealActivities} dense />
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">История появится после первых действий</p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex items-center justify-between border-t px-6 py-3">
        <Button variant="ghost" size="sm" className="text-critical-text hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
          <Trash2 />
          Удалить сделку
        </Button>
        <Button variant="outline" size="sm" onClick={closeDeal}>
          Готово
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Удалить сделку?"
        description={`«${deal.title}» и её история будут удалены без возможности восстановления. Задачи останутся, но потеряют связь со сделкой.`}
        confirmLabel="Удалить"
        onConfirm={() => {
          closeDeal();
          deleteDeal(deal.id);
          toast("Сделка удалена", { description: deal.title });
        }}
      />
    </>
  );
}

/** Карточка сделки в боковой панели: открывается из канбана, таблицы, поиска и уведомлений */
export function DealSheet() {
  const dealId = useUi((s) => s.dealId);
  const closeDeal = useUi((s) => s.closeDeal);
  const deal = useCrm((s) => (dealId ? s.deals.find((d) => d.id === dealId) : undefined));
  const members = useMemberMap();
  const owner = deal ? members.get(deal.ownerId) : undefined;

  return (
    <>
      <Sheet open={Boolean(deal)} onOpenChange={(open) => !open && closeDeal()}>
        <SheetContent
          side="right"
          className="p-0 outline-none sm:max-w-[580px]"
          aria-describedby={undefined}
          // фокус на самой панели, а не в поле названия: открыть сделку — не значит начать её переименовывать
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
        >
          {deal ? (
            <DealDetails key={deal.id} deal={deal} />
          ) : (
            <SheetTitle className="sr-only">Сделка</SheetTitle>
          )}
          {owner && <span className="sr-only">Ответственный: {owner.name}</span>}
        </SheetContent>
      </Sheet>
      <LostReasonDialog />
    </>
  );
}
