"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, ArrowRightLeft, Bell, BellOff, CheckCheck, ListChecks, MessageSquare, UserPlus, Zap, type LucideIcon } from "lucide-react";
import type { AppNotification, NotificationType } from "@/types/crm";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/common/states";
import { useCrm, useNow } from "@/hooks/use-crm";
import { formatRelative } from "@/lib/format";
import { useUi } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

const TYPE_META: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  lead: { icon: UserPlus, tone: "bg-primary-soft text-primary" },
  task: { icon: ListChecks, tone: "bg-muted text-foreground" },
  task_overdue: { icon: AlarmClock, tone: "bg-destructive/10 text-critical-text" },
  deal: { icon: ArrowRightLeft, tone: "bg-muted text-foreground" },
  comment: { icon: MessageSquare, tone: "bg-muted text-foreground" },
  automation: { icon: Zap, tone: "bg-warning/15 text-warning-text" },
};

function NotificationRow({ item, now, onOpen }: { item: AppNotification; now: number; onOpen: (n: AppNotification) => void }) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group flex w-full gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
    >
      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", meta.tone)}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className={cn("flex-1 text-[13px] leading-snug", item.read ? "font-medium text-foreground/80" : "font-semibold")}>{item.title}</span>
          {!item.read && <span aria-label="Не прочитано" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-muted-foreground">{item.body}</span>
        <span className="mt-1 block text-xs text-muted-foreground/80">{formatRelative(item.createdAt, now)}</span>
      </span>
    </button>
  );
}

export function NotificationsPopover() {
  const notifications = useCrm((s) => s.notifications);
  const markRead = useCrm((s) => s.markNotificationRead);
  const markAll = useCrm((s) => s.markAllNotificationsRead);
  const openDeal = useUi((s) => s.openDeal);
  const router = useRouter();
  const now = useNow();
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");

  const unread = notifications.filter((n) => !n.read).length;
  const items = (filter === "unread" ? notifications.filter((n) => !n.read) : notifications).slice(0, 30);

  const onOpen = (n: AppNotification) => {
    markRead(n.id);
    setOpen(false);
    if (!n.href) return;
    const dealMatch = n.href.match(/deal=([^&]+)/);
    if (dealMatch) {
      router.push("/deals");
      openDeal(dealMatch[1]!);
    } else router.push(n.href);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Hint label="Уведомления">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="relative text-muted-foreground hover:text-foreground" aria-label={`Уведомления, непрочитанных: ${unread}`}>
            <Bell />
            {unread > 0 && (
              <span className="tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground ring-2 ring-background">
                {unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent align="end" className="w-[min(400px,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <h2 className="text-[15px] font-semibold">Уведомления</h2>
          <Segmented
            size="sm"
            className="ml-auto"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: "Все" },
              { value: "unread", label: "Новые", count: unread },
            ]}
            aria-label="Фильтр уведомлений"
          />
        </div>
        <div className="scrollbar-thin max-h-[min(460px,65dvh)] overflow-y-auto p-1.5">
          {items.length ? (
            items.map((item) => <NotificationRow key={item.id} item={item} now={now} onOpen={onOpen} />)
          ) : (
            <EmptyState compact icon={BellOff} title="Всё прочитано" description="Новые события по сделкам, лидам и задачам появятся здесь." />
          )}
        </div>
        {unread > 0 && (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={markAll}>
              <CheckCheck />
              Отметить все как прочитанные
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
