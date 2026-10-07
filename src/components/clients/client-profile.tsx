"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, ListChecks, Mail, MapPin, MessagesSquare, Phone, Plug, Plus, Sparkles, SquareKanban, Trash2, UserRound, UserRoundX } from "lucide-react";
import { toast } from "sonner";
import type { Client } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { ActivityFeed } from "@/components/common/activity-feed";
import { CopyButton } from "@/components/common/copy-button";
import { ClientStatusBadge, SourceLabel, StageBadge } from "@/components/common/entity-meta";
import { PageSkeleton } from "@/components/common/skeletons";
import { EmptyState } from "@/components/common/states";
import { UserAvatar } from "@/components/common/user-avatar";
import { AddFieldButton, CustomFieldRows } from "@/components/fields/custom-fields";
import { ChatThread } from "@/components/inbox/chat-thread";
import { useClientConversation } from "@/components/inbox/use-inbox";
import { TaskRow } from "@/components/tasks/task-row";
import { useCrm, useMemberMap, useNow, useReady } from "@/hooks/use-crm";
import { stageLabel } from "@/lib/stages";
import { contactLine } from "@/lib/display";
import { formatCount, formatDate, formatDateLong, formatMoney, formatRelative } from "@/lib/format";
import { clientStatsMap, clientStatus, isOpen, statsFor } from "@/lib/metrics";
import { useUi } from "@/lib/store/ui-store";
import { cn, plural } from "@/lib/utils";

export function ClientProfile({ id }: { id: string }) {
  const ready = useReady();
  const client = useCrm((s) => s.clients.find((c) => c.id === id));
  if (!ready) return <PageSkeleton variant="profile" />;
  if (!client)
    return (
      <div className="rounded-xl border bg-card shadow-card">
        <EmptyState
          icon={UserRoundX}
          title="Клиент не найден"
          description="Возможно, карточку удалили или ссылка устарела."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/clients">
                <ArrowLeft />
                Ко всем клиентам
              </Link>
            </Button>
          }
        />
      </div>
    );
  return <Profile client={client} />;
}

function StatRow({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right", strong && "tabular text-[15px] font-semibold")}>{value}</span>
    </div>
  );
}

function Profile({ client }: { client: Client }) {
  const deals = useCrm((s) => s.deals);
  const tasks = useCrm((s) => s.tasks);
  const activities = useCrm((s) => s.activities);
  const notes = useCrm((s) => s.notes);
  const addNote = useCrm((s) => s.addNote);
  const deleteClient = useCrm((s) => s.deleteClient);
  const members = useMemberMap();
  const { openDialog, openDeal } = useUi.getState();
  const router = useRouter();
  const now = useNow();
  const [note, setNote] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const conversation = useClientConversation(client.id);
  const [tab, setTab] = React.useState(() => (conversation?.unread ? "chat" : "overview"));
  const tabsRef = React.useRef<HTMLDivElement>(null);
  const openChat = () => {
    setTab("chat");
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const clientDeals = React.useMemo(() => deals.filter((d) => d.clientId === client.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [deals, client.id]);
  const stats = statsFor(clientStatsMap(clientDeals), client.id);
  const status = clientStatus(client, stats, now);
  const clientTasks = tasks
    .filter((t) => t.clientId === client.id)
    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.dueAt.localeCompare(b.dueAt));
  const clientActivities = activities.filter((a) => a.clientId === client.id);
  const clientNotes = notes.filter((n) => n.clientId === client.id);
  const owner = members.get(client.ownerId);
  const openDeals = clientDeals.filter(isOpen);
  const nextTask = clientTasks.find((t) => t.status === "open");
  const avgCheck = stats.won ? stats.revenue / stats.won : 0;

  const summary = React.useMemo(() => {
    const parts: string[] = [];
    const who = client.company || client.name;
    const since = formatDateLong(client.createdAt);
    if (stats.deals === 0) {
      parts.push(`${who} — клиент с ${since}, сделок пока не было.`);
    } else if (stats.won === 0) {
      parts.push(`${who} — клиент с ${since}: ${formatCount(stats.deals, ["сделка", "сделки", "сделок"])}, успешных пока нет.`);
    } else {
      parts.push(
        `${who} работает с вами с ${since}: ${formatCount(stats.deals, ["сделка", "сделки", "сделок"])}, из них ${stats.won} ${plural(stats.won, ["успешная", "успешные", "успешных"])} на ${formatMoney(stats.revenue)}.`,
      );
    }
    if (openDeals.length) {
      const top = [...openDeals].sort((a, b) => b.amount - a.amount)[0]!;
      parts.push(
        openDeals.length === 1
          ? `Сейчас в работе сделка «${top.title}» на ${formatMoney(top.amount)}, этап «${stageLabel(top.stage)}».`
          : `Сейчас в работе ${formatCount(openDeals.length, ["сделка", "сделки", "сделок"])} на ${formatMoney(stats.pipeline)}; крупнейшая — «${top.title}» на этапе «${stageLabel(top.stage)}».`,
      );
    }
    const idle = Math.floor((now - Date.parse(client.lastActivityAt)) / 86_400_000);
    if (idle > 30)
      parts.push(
        `Последний контакт был ${formatCount(idle, ["день", "дня", "дней"])} назад — стоит напомнить о себе${stats.won ? " и предложить повторный проект" : ""}.`,
      );
    else if (nextTask) parts.push(`Следующий шаг: «${nextTask.title}».`);
    else if (openDeals.length) parts.push("У открытых сделок нет запланированных задач — поставьте следующий шаг, чтобы сделка не зависла.");
    else if (stats.deals === 0) parts.push("Создайте первую сделку, пока интерес клиента не остыл.");
    return parts.join(" ");
  }, [client, stats, openDeals, now, nextTask]);

  const submitNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    addNote({ body: note.trim(), clientId: client.id, dealId: null });
    setNote("");
    toast.success("Заметка сохранена");
  };

  return (
    <div className="animate-page space-y-5">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        Клиенты
      </Link>

      <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <UserAvatar name={client.name} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-[-0.025em]">{client.name}</h1>
              <ClientStatusBadge status={status} />
              {client.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-[15px] text-muted-foreground">
              {client.company ? <Building2 className="size-4" /> : <UserRound className="size-4" />}
              {client.company || "Частное лицо"}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
              {client.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5 text-muted-foreground" />
                  <span className="tabular">{client.phone}</span>
                  <CopyButton value={client.phone} label="Скопировать телефон" />
                </span>
              )}
              {client.email && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{client.email}</span>
                  <CopyButton value={client.email} label="Скопировать email" />
                </span>
              )}
              {client.city && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {client.city}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:max-w-[560px] lg:justify-end">
            <Button asChild variant="outline" size="sm">
              <a href={`tel:${client.phone.replace(/[^\d+]/g, "")}`}>
                <Phone />
                Позвонить
              </a>
            </Button>
            {conversation ? (
              <Button variant="outline" size="sm" onClick={openChat}>
                <MessagesSquare />
                Написать
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <a href={`mailto:${client.email}`}>
                  <Mail />
                  Написать
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => openDialog("task", { clientId: client.id, ownerId: client.ownerId })}>
              <ListChecks />
              Добавить задачу
            </Button>
            <Button size="sm" onClick={() => openDialog("deal", { clientId: client.id, ownerId: client.ownerId })}>
              <Plus />
              Создать сделку
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Tabs ref={tabsRef} value={tab} onValueChange={setTab} className="min-w-0 scroll-mt-20">
          <TabsList className="max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="chat">
              Переписка
              {conversation && conversation.unread > 0 && (
                <span className="tabular rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{conversation.unread}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="deals">
              Сделки <span className="tabular rounded-full bg-muted px-1.5 text-[11px]">{clientDeals.length}</span>
            </TabsTrigger>
            <TabsTrigger value="tasks">
              Задачи <span className="tabular rounded-full bg-muted px-1.5 text-[11px]">{clientTasks.filter((t) => t.status === "open").length}</span>
            </TabsTrigger>
            <TabsTrigger value="activity">Активность</TabsTrigger>
            <TabsTrigger value="notes">Заметки</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 pt-5">
            <section className="rounded-xl border border-primary/15 bg-primary-soft/40 p-4 dark:bg-primary-soft/30">
              <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-primary">
                <Sparkles className="size-4" />
                Сводка по клиенту
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed">{summary}</p>
            </section>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm">Сделки в работе</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pt-2">
                  {openDeals.length ? (
                    <ul>
                      {openDeals.map((d) => (
                        <li key={d.id}>
                          <button type="button" onClick={() => openDeal(d.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-accent/60">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-medium">{d.title}</span>
                              <span className="tabular block text-xs text-muted-foreground">{formatMoney(d.amount)}</span>
                            </span>
                            <StageBadge stage={d.stage} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState compact icon={SquareKanban} title="Открытых сделок нет" description="Предложите клиенту следующий проект." />
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm">Ближайшие задачи</CardTitle>
                </CardHeader>
                <CardContent className="px-2.5 pt-2">
                  {clientTasks.filter((t) => t.status === "open").length ? (
                    clientTasks
                      .filter((t) => t.status === "open")
                      .slice(0, 4)
                      .map((t) => <TaskRow key={t.id} task={t} now={now} compact />)
                  ) : (
                    <EmptyState compact icon={ListChecks} title="Задач нет" description="Поставьте следующий шаг по клиенту." />
                  )}
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm">Недавняя активность</CardTitle>
              </CardHeader>
              <CardContent className="px-2.5 pt-2">
                {clientActivities.length ? (
                  <ActivityFeed activities={clientActivities.slice(0, 6)} dense />
                ) : (
                  <p className="px-2 py-4 text-sm text-muted-foreground">Событий за последние две недели нет.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat" className="pt-5">
            {conversation ? (
              <ChatThread conversation={conversation} compact className="h-[520px] overflow-hidden rounded-xl border bg-card shadow-card" />
            ) : (
              <div className="rounded-xl border bg-card shadow-card">
                <EmptyState
                  icon={MessagesSquare}
                  title="Переписки с клиентом пока нет"
                  description="Подключите Telegram, WhatsApp, MAX или ВКонтакте — сообщения клиента будут появляться здесь и во «Входящих»."
                  action={
                    <Button asChild size="sm" variant="outline">
                      <Link href="/settings/integrations">
                        <Plug />
                        Подключить мессенджеры
                      </Link>
                    </Button>
                  }
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="deals" className="pt-5">
            <div className="overflow-hidden rounded-xl border bg-card shadow-card">
              {clientDeals.length ? (
                <ul className="divide-y">
                  {clientDeals.map((d) => (
                    <li key={d.id}>
                      <button type="button" onClick={() => openDeal(d.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-accent/45">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium">{d.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {d.closedAt ? `Закрыта ${formatDate(d.closedAt, now)}` : `Создана ${formatDate(d.createdAt, now)}`}
                          </span>
                        </span>
                        <StageBadge stage={d.stage} />
                        <span className="tabular w-28 text-right text-[13.5px] font-semibold">{formatMoney(d.amount)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={SquareKanban} title="Сделок пока нет" description="Создайте первую сделку с этим клиентом." />
              )}
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="pt-4">
            <div className="rounded-xl border bg-card p-2 shadow-card">
              {clientTasks.length ? (
                clientTasks.map((t) => <TaskRow key={t.id} task={t} now={now} />)
              ) : (
                <EmptyState compact icon={ListChecks} title="Задач нет" description="Задачи по клиенту появятся здесь." />
              )}
              <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => openDialog("task", { clientId: client.id, ownerId: client.ownerId })}>
                <Plus />
                Добавить задачу
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="pt-4">
            <div className="rounded-xl border bg-card p-2 shadow-card">
              {clientActivities.length ? (
                <ActivityFeed activities={clientActivities} />
              ) : (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">История событий появится после первых действий</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="space-y-4 pt-5">
            <form onSubmit={submitNote} className="space-y-2 rounded-xl border bg-card p-3 shadow-card">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Что важно помнить об этом клиенте?"
                rows={3}
                className="border-0 shadow-none focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote(e);
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">⌘ + Enter — сохранить</span>
                <Button type="submit" size="sm" disabled={!note.trim()}>
                  Сохранить заметку
                </Button>
              </div>
            </form>
            {clientNotes.map((n) => {
              const author = members.get(n.authorId);
              return (
                <article key={n.id} className="rounded-xl border bg-card p-4 shadow-card">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UserAvatar name={author?.name ?? "?"} hue={author?.hue} size="xs" />
                    <span className="font-medium text-foreground">{author?.name}</span>
                    {formatRelative(n.createdAt, now)}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed">{n.body}</p>
                </article>
              );
            })}
          </TabsContent>
        </Tabs>

        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">Ценность клиента</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-[30px] font-semibold leading-none tracking-[-0.03em]">{formatMoney(stats.revenue)}</div>
              <p className="mt-1.5 text-xs text-muted-foreground">Общая выручка за всё время</p>
              <div className="mt-4 divide-y border-t">
                <StatRow label="Сделок всего" value={stats.deals} strong />
                <StatRow label="Успешных" value={stats.won} />
                <StatRow label="Средний чек" value={stats.won ? formatMoney(avgCheck) : "—"} />
                <StatRow label="В работе" value={stats.openDeals ? formatMoney(stats.pipeline) : "—"} />
                <StatRow label="Последний контакт" value={formatRelative(client.lastActivityAt, now)} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="divide-y pt-2">
              <StatRow
                label="Ответственный"
                value={
                  owner ? (
                    <span className="inline-flex items-center gap-2">
                      <UserAvatar name={owner.name} hue={owner.hue} size="xs" />
                      {owner.name}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <StatRow label="Источник" value={<SourceLabel source={client.source} />} />
              <StatRow label="Клиент с" value={formatDateLong(client.createdAt)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">Данные клиента</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <CustomFieldRows entity="client" entityId={client.id} values={client.custom} labelClassName="w-[112px]" />
              <AddFieldButton entity="client" className="-ml-2 mt-1" />
            </CardContent>
          </Card>
          <Button variant="ghost" size="sm" className="w-full text-critical-text hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
            <Trash2 />
            Удалить клиента
          </Button>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Удалить клиента?"
        description={`Вместе с ${client.name} удалятся ${stats.deals} ${plural(stats.deals, ["сделка", "сделки", "сделок"])}, задачи и заметки. Восстановить данные будет нельзя.`}
        confirmLabel="Удалить навсегда"
        onConfirm={() => {
          router.push("/clients");
          deleteClient(client.id);
          toast("Клиент удалён", { description: contactLine(client) });
        }}
      />
    </div>
  );
}
