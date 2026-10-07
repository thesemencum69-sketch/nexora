"use client";

import * as React from "react";
import { Building2, CalendarDays, Clock, UserRound } from "lucide-react";
import type { Client, Deal, Member } from "@/types/crm";
import { PriorityIcon } from "@/components/common/entity-meta";
import { UserAvatar } from "@/components/common/user-avatar";
import { STALE_DEAL_DAYS } from "@/lib/constants";
import { accountName } from "@/lib/display";
import { formatDate, formatMoney, formatRelativeShort } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DealCardProps {
  deal: Deal;
  client?: Client;
  owner?: Member;
  now: number;
  dragging?: boolean;
  overlay?: boolean;
}

/** Карточка сделки на канбане: название, клиент, сумма, ответственный, активность, дата, приоритет */
export function DealCardView({ deal, client, owner, now, dragging, overlay }: DealCardProps) {
  const idleDays = Math.floor((now - Date.parse(deal.lastActivityAt)) / 86_400_000);
  const open = deal.stage !== "won" && deal.stage !== "lost";
  const stale = open && idleDays >= STALE_DEAL_DAYS;
  const overdue = open && Date.parse(deal.expectedCloseAt) < now;

  return (
    <div
      className={cn(
        "group/card relative rounded-lg border bg-card p-3 text-left shadow-card transition-[box-shadow,border-color,opacity,transform] duration-150",
        "hover:border-input hover:shadow-raised",
        dragging && "opacity-35",
        overlay && "rotate-[1.5deg] scale-[1.02] cursor-grabbing border-input shadow-overlay",
        deal.stage === "lost" && "bg-card/70",
      )}
    >
      <div className="flex items-start gap-2">
        <p className={cn("line-clamp-2 flex-1 text-[13.5px] font-medium leading-snug", deal.stage === "lost" && "text-muted-foreground")}>{deal.title}</p>
        <PriorityIcon priority={deal.priority} className="mt-0.5" />
      </div>
      {client && (
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
          {client.company ? <Building2 className="size-3.5 shrink-0" /> : <UserRound className="size-3.5 shrink-0" />}
          <span className="truncate">{accountName(client)}</span>
        </p>
      )}
      <p className={cn("tabular mt-2.5 text-[15px] font-semibold tracking-[-0.01em]", deal.stage === "lost" && "text-muted-foreground line-through decoration-1")}>
        {formatMoney(deal.amount)}
      </p>
      <div className="mt-2.5 flex items-center gap-2 border-t border-dashed pt-2.5 text-xs text-muted-foreground">
        {owner && <UserAvatar name={owner.name} hue={owner.hue} size="xs" />}
        <span
          className={cn("inline-flex items-center gap-1", stale && "rounded-full bg-warning/15 px-1.5 py-0.5 font-medium text-warning-text")}
          title="Последняя активность"
        >
          <Clock className="size-3" />
          {stale ? `${idleDays} дн. без движения` : formatRelativeShort(deal.lastActivityAt, now)}
        </span>
        <span
          className={cn("ml-auto inline-flex items-center gap-1", overdue && "font-medium text-critical-text")}
          title={open ? "Ожидаемая дата закрытия" : "Дата закрытия"}
        >
          <CalendarDays className="size-3" />
          {formatDate(deal.closedAt ?? deal.expectedCloseAt, now)}
        </span>
      </div>
    </div>
  );
}
