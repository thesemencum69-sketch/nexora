"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, Check, MoreHorizontal, Pencil, SquareKanban, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import type { Task } from "@/types/crm";
import { PriorityIcon } from "@/components/common/entity-meta";
import { UserAvatar } from "@/components/common/user-avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Hint } from "@/components/ui/tooltip";
import { useClientMap, useCrm, useDealMap, useMemberMap } from "@/hooks/use-crm";
import { accountName } from "@/lib/display";
import { formatDue } from "@/lib/format";
import { useUi } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

/** Чекбокс задачи с короткой анимацией выполнения */
export function TaskCheck({ done, onToggle, label }: { done: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
        done ? "border-success bg-success text-white" : "border-muted-foreground/40 hover:border-success hover:bg-success/10",
      )}
    >
      {done && <Check className="size-3 animate-pop" strokeWidth={3} />}
    </button>
  );
}

export function useToggleTask() {
  const toggle = useCrm((s) => s.toggleTask);
  return (task: Task) => {
    const done = toggle(task.id);
    if (done) {
      toast.success("Задача выполнена", {
        description: task.title,
        action: { label: "Отменить", onClick: () => toggle(task.id) },
      });
    }
  };
}

export function TaskRow({ task, now, showAssignee = true, compact = false }: { task: Task; now: number; showAssignee?: boolean; compact?: boolean }) {
  const members = useMemberMap();
  const deals = useDealMap();
  const clients = useClientMap();
  const toggle = useToggleTask();
  const deleteTask = useCrm((s) => s.deleteTask);
  const { openDeal, openDialog } = useUi.getState();

  const done = task.status === "done";
  const overdue = !done && Date.parse(task.dueAt) < now;
  const assignee = members.get(task.assigneeId);
  const deal = task.dealId ? deals.get(task.dealId) : undefined;
  const client = task.clientId ? clients.get(task.clientId) : undefined;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg px-2.5 transition-colors hover:bg-accent/60",
        compact ? "py-2" : "py-3",
        done && "opacity-60",
      )}
    >
      <div className="pt-0.5">
        <TaskCheck done={done} onToggle={() => toggle(task)} label={done ? "Вернуть в работу" : "Отметить выполненной"} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className={cn("flex-1 text-[13.5px] font-medium leading-snug", done && "text-muted-foreground line-through decoration-muted-foreground/50")}>{task.title}</span>
          <PriorityIcon priority={task.priority} className="mt-0.5" />
        </div>
        {!compact && task.description && <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">{task.description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className={cn("inline-flex items-center gap-1", overdue ? "font-medium text-critical-text" : "text-muted-foreground")}>
            <CalendarClock className="size-3.5" />
            {done && task.completedAt ? `Выполнено ${formatDue(task.completedAt, now).toLowerCase()}` : formatDue(task.dueAt, now)}
            {overdue && <span className="sr-only">(просрочено)</span>}
          </span>
          {deal && (
            <button
              type="button"
              onClick={() => openDeal(deal.id)}
              className="inline-flex min-w-0 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <SquareKanban className="size-3.5 shrink-0" />
              <span className="max-w-48 truncate">{deal.title}</span>
            </button>
          )}
          {client && (
            <Link href={`/clients/${client.id}`} className="inline-flex min-w-0 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
              <Users className="size-3.5 shrink-0" />
              <span className="max-w-48 truncate">{accountName(client)}</span>
            </Link>
          )}
        </div>
      </div>
      {showAssignee && assignee && (
        <Hint label={assignee.name}>
          <span>
            <UserAvatar name={assignee.name} hue={assignee.hue} size="sm" />
          </span>
        </Hint>
      )}
      {!compact && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-md p-1 text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            aria-label="Действия с задачей"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => openDialog("task", { title: task.title, dealId: task.dealId ?? undefined, clientId: task.clientId ?? undefined })}>
              <Pencil />
              Создать похожую
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                deleteTask(task.id);
                toast("Задача удалена", { description: task.title });
              }}
            >
              <Trash2 />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
