"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarCheck2, Plus } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/common/states";
import { TaskRow } from "@/components/tasks/task-row";
import { useCrm } from "@/hooks/use-crm";
import { endOfDay } from "@/lib/time";
import { useUi } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

export function TodayTasksCard({ now, className }: { now: number; className?: string }) {
  const tasks = useCrm((s) => s.tasks);
  const me = useCrm((s) => s.currentUserId);
  const openDialog = useUi((s) => s.openDialog);
  const [scope, setScope] = React.useState<"team" | "mine">("team");

  const list = React.useMemo(() => {
    const limit = endOfDay(now);
    return tasks
      .filter((t) => t.status === "open" && Date.parse(t.dueAt) <= limit && (scope === "team" || t.assigneeId === me))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }, [tasks, now, scope, me]);

  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <div>
          <CardTitle>Задачи на сегодня</CardTitle>
          <CardDescription>Включая просроченные</CardDescription>
        </div>
        <CardAction>
          <Segmented
            size="sm"
            value={scope}
            onValueChange={setScope}
            options={[
              { value: "team", label: "Команда" },
              { value: "mine", label: "Мои" },
            ]}
            aria-label="Чьи задачи показать"
          />
        </CardAction>
      </CardHeader>
      <CardContent className="relative min-h-[340px] flex-1 p-0 xl:min-h-0">
        {list.length === 0 ? (
          <EmptyState
            compact
            icon={CalendarCheck2}
            title="На сегодня всё"
            description="Новых задач на сегодня нет. Самое время спланировать завтра."
            action={
              <Button size="sm" variant="outline" onClick={() => openDialog("task")}>
                <Plus />
                Поставить задачу
              </Button>
            }
          />
        ) : (
          <div className="scrollbar-thin absolute inset-0 overflow-y-auto px-2.5 pb-2 pt-3">
            {list.slice(0, 20).map((task) => (
              <TaskRow key={task.id} task={task} now={now} compact />
            ))}
          </div>
        )}
      </CardContent>
      {list.length > 0 && (
        <CardFooter className="justify-between py-2.5">
          <span className="text-xs text-muted-foreground">{list.length} в списке</span>
          <Button asChild variant="ghost" size="xs">
            <Link href="/tasks">Все задачи</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
