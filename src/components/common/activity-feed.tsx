"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  CheckCheck,
  CircleX,
  FileCheck2,
  FileText,
  MessageSquare,
  SquareKanban,
  Trophy,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Activity, ActivityType, Member } from "@/types/crm";
import { SOURCE_BY_ID } from "@/lib/constants";
import { stageLabel } from "@/lib/stages";
import { formatMoney, formatRelative } from "@/lib/format";
import { useUi } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { useClientMap, useDealMap, useMemberMap, useNow } from "@/hooks/use-crm";
import { UserAvatar } from "./user-avatar";

const ICONS: Record<ActivityType, LucideIcon> = {
  lead_created: UserPlus,
  client_created: Users,
  deal_created: SquareKanban,
  deal_stage_changed: ArrowRightLeft,
  deal_won: Trophy,
  deal_lost: CircleX,
  task_completed: CheckCheck,
  comment: MessageSquare,
  automation: Zap,
  document_issued: FileText,
  document_paid: FileCheck2,
};

const by = (member: Member | undefined, m: string, f: string) => (member?.gender === "f" ? f : m);

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

function describe(a: Activity, actor: Member | undefined, dealTitle?: string, company?: string): React.ReactNode {
  const name = actor ? <Strong>{actor.name.split(" ")[0]}</Strong> : null;
  const title = a.meta?.title ?? dealTitle;
  switch (a.type) {
    case "lead_created":
      return (
        <>
          <Strong>{a.meta?.name}</Strong> {a.meta?.gender === "f" ? "оставила" : "оставил"} заявку
          {a.meta?.source ? ` ${SOURCE_BY_ID[a.meta.source].from}` : ""}
        </>
      );
    case "client_created":
      return (
        <>
          {name} {by(actor, "добавил", "добавила")} клиента <Strong>{a.meta?.title ?? a.meta?.name}</Strong>
        </>
      );
    case "deal_created":
      return (
        <>
          {name} {by(actor, "создал", "создала")} сделку <Strong>«{title}»</Strong>
          {a.meta?.amount ? ` на ${formatMoney(a.meta.amount)}` : ""}
        </>
      );
    case "deal_stage_changed":
      return (
        <>
          {name} {by(actor, "перевёл", "перевела")} <Strong>«{title}»</Strong> в «{a.meta?.to ? stageLabel(a.meta.to) : "новый этап"}»
        </>
      );
    case "deal_won":
      return (
        <>
          {name} {by(actor, "закрыл", "закрыла")} сделку <Strong>«{title}»</Strong>
          {company ? ` с ${company}` : ""}
        </>
      );
    case "deal_lost":
      return (
        <>
          {name} {by(actor, "отметил", "отметила")} <Strong>«{title}»</Strong> как проигранную{a.meta?.text ? `: ${a.meta.text.toLowerCase()}` : ""}
        </>
      );
    case "task_completed":
      return (
        <>
          {name} {by(actor, "выполнил", "выполнила")} задачу <Strong>«{a.meta?.title}»</Strong>
        </>
      );
    case "comment":
      return (
        <>
          {name} {by(actor, "оставил", "оставила")} комментарий: «{a.meta?.text}»
        </>
      );
    case "automation":
      return (
        <>
          Сработала автоматизация <Strong>«{a.meta?.title}»</Strong>
        </>
      );
    case "document_issued":
      return (
        <>
          {name} {by(actor, "выставил", "выставила")} {a.meta?.kind === "proposal" ? "КП" : "счёт"} <Strong>№ {a.meta?.number}</Strong>
          {a.meta?.amount ? ` на ${formatMoney(a.meta.amount)}` : ""}
        </>
      );
    case "document_paid":
      return (
        <>
          Счёт <Strong>№ {a.meta?.number}</Strong> оплачен{a.meta?.amount ? ` — ${formatMoney(a.meta.amount)}` : ""}
        </>
      );
  }
}

export function ActivityItem({ activity, now, dense = false }: { activity: Activity; now: number; dense?: boolean }) {
  const members = useMemberMap();
  const deals = useDealMap();
  const clients = useClientMap();
  const router = useRouter();
  const openDeal = useUi((s) => s.openDeal);

  const actor = activity.actorId ? members.get(activity.actorId) : undefined;
  const deal = activity.dealId ? deals.get(activity.dealId) : undefined;
  const client = activity.clientId ? clients.get(activity.clientId) : undefined;
  const Icon = ICONS[activity.type];
  const avatarName = actor?.name ?? (activity.type === "lead_created" ? activity.meta?.name : undefined);

  const open = () => {
    if (deal) openDeal(deal.id);
    else if (client) router.push(`/clients/${client.id}`);
    else if (activity.type === "lead_created") router.push(`/leads?q=${encodeURIComponent(activity.meta?.name ?? "")}`);
    else if (activity.type === "automation") router.push("/automations");
  };

  return (
    <li>
      <button
        type="button"
        onClick={open}
        className={cn(
          "group flex w-full gap-3 rounded-lg text-left outline-none transition-colors hover:bg-accent/70 focus-visible:bg-accent",
          dense ? "px-2 py-2" : "px-2.5 py-2.5",
        )}
      >
        <span className="relative mt-0.5 shrink-0">
          {avatarName ? (
            <UserAvatar name={avatarName} hue={actor?.hue} size="md" />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-full bg-warning/15 text-warning-text">
              <Zap className="size-4" />
            </span>
          )}
          {avatarName && (
            <span
              className={cn(
                "absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full ring-2 ring-card",
                activity.type === "deal_won" || activity.type === "document_paid"
                  ? "bg-success text-white"
                  : activity.type === "deal_lost"
                    ? "bg-destructive text-white"
                    : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="size-2.5" strokeWidth={2.5} />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">
            {describe(activity, actor, deal?.title, client?.company || client?.name)}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground/80">{formatRelative(activity.createdAt, now)}</span>
        </span>
      </button>
    </li>
  );
}

export function ActivityFeed({ activities, dense, className }: { activities: Activity[]; dense?: boolean; className?: string }) {
  const now = useNow();
  return (
    <ul className={cn("grid", className)}>
      {activities.map((a) => (
        <ActivityItem key={a.id} activity={a} now={now} dense={dense} />
      ))}
    </ul>
  );
}
