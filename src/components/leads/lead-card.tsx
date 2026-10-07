"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, Mail, MessageSquareReply, MessagesSquare, MoreHorizontal, Phone, RotateCcw, SquareKanban, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import type { Lead, Member } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LeadStatusBadge, SourceChip } from "@/components/common/entity-meta";
import { UserAvatar } from "@/components/common/user-avatar";
import { useLeadConversation } from "@/components/inbox/use-inbox";
import { LEAD_RESPONSE_SLA_MIN } from "@/lib/constants";
import { accountName } from "@/lib/display";
import { formatDuration, formatMoney, formatRelative } from "@/lib/format";
import { responseMinutes } from "@/lib/metrics";
import { useCrm } from "@/hooks/use-crm";
import { useUi } from "@/lib/store/ui-store";
import { MINUTE } from "@/lib/time";
import { cn } from "@/lib/utils";

export function ResponseChip({ lead, now }: { lead: Lead; now: number }) {
  const minutes = responseMinutes(lead);
  if (minutes !== null) {
    return (
      <span className={cn("text-xs", minutes > LEAD_RESPONSE_SLA_MIN ? "text-warning-text" : "text-muted-foreground")}>
        Ответ за {formatDuration(minutes)}
      </span>
    );
  }
  if (lead.status !== "new") return null;
  const waiting = (now - Date.parse(lead.createdAt)) / MINUTE;
  const late = waiting > LEAD_RESPONSE_SLA_MIN;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium", late ? "text-critical-text" : "text-warning-text")}>
      <span className="relative flex size-2">
        <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", late ? "bg-destructive" : "bg-warning")} />
        <span className={cn("relative inline-flex size-2 rounded-full", late ? "bg-destructive" : "bg-warning")} />
      </span>
      Ждёт ответа {formatDuration(waiting)}
    </span>
  );
}

/** Главное действие по лиду зависит от его статуса — следующий шаг в один клик */
export function useLeadActions() {
  const updateLead = useCrm((s) => s.updateLead);
  const convertLead = useCrm((s) => s.convertLead);
  const deleteLead = useCrm((s) => s.deleteLead);
  const openDeal = useUi((s) => s.openDeal);

  return {
    take: (lead: Lead) => {
      updateLead(lead.id, { status: "contacted" });
      toast.success("Лид в работе", { description: `${lead.name}: время ответа зафиксировано` });
    },
    qualify: (lead: Lead) => {
      updateLead(lead.id, { status: "qualified" });
      toast.success("Лид квалифицирован", { description: lead.name });
    },
    convert: (lead: Lead) => {
      const result = convertLead(lead.id);
      if (!result) return;
      toast.success("Создана сделка", {
        description: `${accountName(result.client)}${result.deal.amount ? `, ${formatMoney(result.deal.amount)}` : ""}`,
        action: { label: "Открыть", onClick: () => openDeal(result.deal.id) },
      });
    },
    disqualify: (lead: Lead) => {
      const prev = lead.status;
      updateLead(lead.id, { status: "disqualified" });
      toast("Лид отмечен как отказ", { description: lead.name, action: { label: "Отменить", onClick: () => updateLead(lead.id, { status: prev }) } });
    },
    restore: (lead: Lead) => updateLead(lead.id, { status: "contacted" }),
    remove: (lead: Lead) => {
      deleteLead(lead.id);
      toast("Лид удалён", { description: lead.name });
    },
    openDeal,
  };
}

export function LeadPrimaryAction({ lead, size = "xs" }: { lead: Lead; size?: "xs" | "sm" }) {
  const actions = useLeadActions();
  const conversation = useLeadConversation(lead.id);
  switch (lead.status) {
    case "new":
      // написал в мессенджер — отвечаем там же, ответ сам переведёт лида в работу
      if (conversation)
        return (
          <Button size={size} asChild>
            <Link href={`/inbox?c=${conversation.id}`}>
              <MessageSquareReply />
              Ответить
            </Link>
          </Button>
        );
      return (
        <Button size={size} onClick={() => actions.take(lead)}>
          <UserCheck />
          Взять в работу
        </Button>
      );
    case "contacted":
      return (
        <Button size={size} variant="outline" onClick={() => actions.qualify(lead)}>
          Квалифицировать
        </Button>
      );
    case "qualified":
      return (
        <Button size={size} onClick={() => actions.convert(lead)}>
          <SquareKanban />
          Создать сделку
        </Button>
      );
    case "converted":
      return lead.dealId ? (
        <Button size={size} variant="ghost" onClick={() => actions.openDeal(lead.dealId!)}>
          <SquareKanban />
          Открыть сделку
        </Button>
      ) : null;
    case "disqualified":
      return (
        <Button size={size} variant="ghost" onClick={() => actions.restore(lead)}>
          <RotateCcw />
          Вернуть в работу
        </Button>
      );
  }
}

export function LeadMenu({ lead }: { lead: Lead }) {
  const actions = useLeadActions();
  const conversation = useLeadConversation(lead.id);
  const [confirm, setConfirm] = React.useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-md p-1 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40" aria-label="Действия с лидом">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {conversation && (
            <DropdownMenuItem asChild>
              <Link href={`/inbox?c=${conversation.id}`}>
                <MessagesSquare />
                Открыть переписку
              </Link>
            </DropdownMenuItem>
          )}
          {lead.status === "new" && conversation && (
            <DropdownMenuItem onSelect={() => actions.take(lead)}>
              <UserCheck />
              Взять в работу
            </DropdownMenuItem>
          )}
          {lead.phone && (
            <DropdownMenuItem asChild>
              <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}>
                <Phone />
                Позвонить
              </a>
            </DropdownMenuItem>
          )}
          {lead.email && (
            <DropdownMenuItem asChild>
              <a href={`mailto:${lead.email}`}>
                <Mail />
                Написать письмо
              </a>
            </DropdownMenuItem>
          )}
          {lead.status !== "converted" && lead.status !== "qualified" && (
            <DropdownMenuItem onSelect={() => actions.convert(lead)}>
              <SquareKanban />
              Сразу в сделку
            </DropdownMenuItem>
          )}
          {lead.status !== "disqualified" && lead.status !== "converted" && (
            <DropdownMenuItem onSelect={() => actions.disqualify(lead)}>
              <Ban />
              Отказ
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
            <Trash2 />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Удалить лида?"
        description={`${lead.name} пропадёт из списка и отчётов по источникам. Действие нельзя отменить.`}
        confirmLabel="Удалить"
        onConfirm={() => actions.remove(lead)}
      />
    </>
  );
}

export function LeadCard({ lead, owner, now }: { lead: Lead; owner?: Member; now: number }) {
  return (
    <article className="group flex flex-col rounded-xl border bg-card p-4 shadow-card transition-shadow hover:shadow-raised">
      <div className="flex items-start gap-3">
        <UserAvatar name={lead.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14.5px] font-semibold">{lead.name}</h3>
          <p className="truncate text-[13px] text-muted-foreground">{lead.company || "Частное лицо"}</p>
        </div>
        <LeadStatusBadge status={lead.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <SourceChip source={lead.source} />
        <ResponseChip lead={lead} now={now} />
      </div>
      {lead.message && <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">«{lead.message}»</p>}
      <div className="min-h-3 flex-1" />
      <div className="flex items-center gap-2 border-t pt-3">
        {owner && <UserAvatar name={owner.name} hue={owner.hue} size="xs" />}
        <span className="truncate text-xs text-muted-foreground">
          {owner?.name.split(" ")[0]}, {formatRelative(lead.createdAt, now)}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <LeadPrimaryAction lead={lead} />
          <LeadMenu lead={lead} />
        </div>
      </div>
    </article>
  );
}
