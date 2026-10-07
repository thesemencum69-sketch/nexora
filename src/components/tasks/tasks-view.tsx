"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AlarmClockCheck, CalendarCheck2, CalendarClock, CircleCheckBig, Plus } from "lucide-react";
import type { ID, Task } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { PageSkeleton } from "@/components/common/skeletons";
import { EmptyState } from "@/components/common/states";
import { SearchInput } from "@/components/common/table-parts";
import { UserAvatar } from "@/components/common/user-avatar";
import { useCrm, useMemberMap, useNow, useReady } from "@/hooks/use-crm";
import { formatDate } from "@/lib/format";
import { useUi } from "@/lib/store/ui-store";
import { calendarDaysBetween, endOfDay } from "@/lib/time";
import { matchesQuery } from "@/lib/utils";
import { TaskRow } from "./task-row";

type Tab = "today" | "overdue" | "upcoming" | "done";

const EMPTY: Record<Tab, { title: string; description: string; icon: typeof Plus }> = {
  today: { title: "На сегодня задач нет", description: "Запланируйте звонок или встречу — так сделки не зависают.", icon: CalendarCheck2 },
  overdue: { title: "Просрочек нет", description: "Все задачи выполняются вовремя. Так держать.", icon: AlarmClockCheck },
  upcoming: { title: "Впереди пусто", description: "Добавьте задачи на будущее, чтобы ничего не забыть.", icon: CalendarClock },
  done: { title: "Пока ничего не выполнено", description: "Отмечайте задачи выполненными — они появятся здесь.", icon: CircleCheckBig },
};

function dayHeading(dueAt: string, now: number) {
  const days = calendarDaysBetween(now, dueAt);
  if (days === 1) return "Завтра";
  if (days === 2) return "Послезавтра";
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(new Date(dueAt));
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${formatDate(dueAt, now)}`;
}

export function TasksView() {
  const ready = useReady();
  if (!ready) return <PageSkeleton variant="table" />;
  return <Tasks />;
}

function Tasks() {
  const params = useSearchParams();
  const tasks = useCrm((s) => s.tasks);
  const me = useCrm((s) => s.currentUserId);
  const members = useMemberMap();
  const openDialog = useUi((s) => s.openDialog);
  const now = useNow();

  const initialTab = params.get("tab");
  const [tab, setTab] = React.useState<Tab>(initialTab === "overdue" || initialTab === "upcoming" || initialTab === "done" ? initialTab : "today");
  const [assignee, setAssignee] = React.useState<ID | "all" | "me">("all");
  const [query, setQuery] = React.useState(() => params.get("q") ?? "");
  const [doneLimit, setDoneLimit] = React.useState(25);

  const scoped = React.useMemo(
    () =>
      tasks.filter(
        (t) =>
          (assignee === "all" || (assignee === "me" ? t.assigneeId === me : t.assigneeId === assignee)) &&
          matchesQuery(query, t.title, t.description),
      ),
    [tasks, assignee, me, query],
  );

  const groups = React.useMemo(() => {
    const todayEnd = endOfDay(now);
    const g: Record<Tab, Task[]> = { today: [], overdue: [], upcoming: [], done: [] };
    for (const t of scoped) {
      if (t.status === "done") g.done.push(t);
      else if (Date.parse(t.dueAt) < now) g.overdue.push(t);
      else if (Date.parse(t.dueAt) <= todayEnd) g.today.push(t);
      else g.upcoming.push(t);
    }
    g.today.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    g.overdue.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    g.upcoming.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    g.done.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    return g;
  }, [scoped, now]);

  const list = tab === "done" ? groups.done.slice(0, doneLimit) : groups[tab];
  const empty = EMPTY[tab];

  return (
    <div className="animate-page space-y-5">
      <PageHeader
        title="Задачи"
        description={`${groups.today.length} на сегодня${groups.overdue.length ? `, ${groups.overdue.length} просрочено` : ""}`}
        actions={
          <Button size="sm" onClick={() => openDialog("task")}>
            <Plus />
            Новая задача
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "today", label: "Сегодня", count: groups.today.length },
            { value: "overdue", label: "Просрочено", count: groups.overdue.length },
            { value: "upcoming", label: "Предстоящие", count: groups.upcoming.length },
            { value: "done", label: "Выполненные", count: groups.done.length },
          ]}
          aria-label="Группа задач"
        />
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <SearchInput value={query} onChange={setQuery} placeholder="Поиск по задачам" className="w-full sm:w-56" />
          <Select value={assignee} onValueChange={(v: ID | "all" | "me") => setAssignee(v)}>
            <SelectTrigger size="sm" className="w-auto min-w-[160px]" aria-label="Ответственный">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Вся команда</SelectItem>
              <SelectItem value="me">Мои задачи</SelectItem>
              {[...members.values()].map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <UserAvatar name={m.name} hue={m.hue} size="xs" />
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-2 shadow-card">
        {list.length === 0 ? (
          <EmptyState
            icon={empty.icon}
            title={empty.title}
            description={empty.description}
            action={
              tab !== "done" && tab !== "overdue" ? (
                <Button size="sm" variant="outline" onClick={() => openDialog("task")}>
                  <Plus />
                  Поставить задачу
                </Button>
              ) : undefined
            }
          />
        ) : tab === "upcoming" ? (
          list.map((task, index) => {
            const heading = dayHeading(task.dueAt, now);
            const showHeading = index === 0 || heading !== dayHeading(list[index - 1]!.dueAt, now);
            return (
              <React.Fragment key={task.id}>
                {showHeading && <h3 className="px-2.5 pb-1 pt-3 text-xs font-medium text-muted-foreground first:pt-1.5">{heading}</h3>}
                <TaskRow task={task} now={now} />
              </React.Fragment>
            );
          })
        ) : (
          list.map((task) => <TaskRow key={task.id} task={task} now={now} />)
        )}
        {tab === "done" && groups.done.length > doneLimit && (
          <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => setDoneLimit((n) => n + 25)}>
            Показать ещё
          </Button>
        )}
      </div>
    </div>
  );
}
