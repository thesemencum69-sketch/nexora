"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, Mail, Phone, Plus, Sparkles, SquareKanban, UserRound } from "lucide-react";
import { toast } from "sonner";
import type { Conversation } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/common/copy-button";
import { SourceLabel, StageBadge } from "@/components/common/entity-meta";
import { MemberSelect } from "@/components/forms/form-controls";
import { useCrm, useNow } from "@/hooks/use-crm";
import { formatMoney } from "@/lib/format";
import { summarize } from "@/lib/inbox";
import { useUi } from "@/lib/store/ui-store";
import { DAY, atTime, iso } from "@/lib/time";
import { ConversationAvatar } from "./conversation-avatar";
import { useAssistContext, useConversationContext, useConversationMessages } from "./use-inbox";

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-t px-5 py-4 first:border-t-0">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Правая колонка «Входящих»: кто это, что за сделка, что делать дальше */
export function ContextPanel({ conversation }: { conversation: Conversation }) {
  const messages = useConversationMessages(conversation.id);
  const now = useNow();
  const { lead, deal, client } = useConversationContext(conversation);
  const assist = useAssistContext(conversation, messages, now);
  const summary = summarize(assist);
  const assignConversation = useCrm((s) => s.assignConversation);
  const convertLead = useCrm((s) => s.convertLead);
  const currentUserId = useCrm((s) => s.currentUserId);
  const { openDeal, openDialog } = useUi.getState();
  const phone = client?.phone || lead?.phone;
  const email = client?.email || lead?.email;

  const createDeal = () => {
    if (lead && !lead.dealId) {
      const result = convertLead(lead.id);
      if (result) {
        toast.success("Сделка создана", { description: "Контакт, источник и бюджет перенесены из переписки" });
        openDeal(result.deal.id);
      }
    } else if (client) {
      openDialog("deal", { clientId: client.id, ownerId: conversation.ownerId ?? currentUserId });
    }
  };

  const tomorrow = iso(atTime(now + DAY, 10));

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-col items-center px-5 pb-4 pt-6 text-center">
        <ConversationAvatar conversation={conversation} size="lg" className="scale-125" />
        <h2 className="mt-4 text-[15px] font-semibold">{conversation.contactName}</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{client?.company || lead?.company || "Частное лицо"}</p>
        <div className="mt-2">
          <SourceLabel source={conversation.channel} className="text-xs text-muted-foreground" />
        </div>
      </div>

      <Section title="Контакты">
        <ul className="space-y-1.5 text-[13px]">
          {phone && (
            <li className="flex items-center gap-2">
              <Phone className="size-3.5 shrink-0 text-muted-foreground" />
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="tabular truncate hover:underline">
                {phone}
              </a>
              <CopyButton value={phone} label="Скопировать телефон" className="ml-auto" />
            </li>
          )}
          {email && (
            <li className="flex items-center gap-2">
              <Mail className="size-3.5 shrink-0 text-muted-foreground" />
              <a href={`mailto:${email}`} className="truncate hover:underline">
                {email}
              </a>
              <CopyButton value={email} label="Скопировать email" className="ml-auto" />
            </li>
          )}
          {!phone && !email && <li className="text-muted-foreground">{conversation.handle}</li>}
        </ul>
      </Section>

      <Section title="Сделка">
        {deal ? (
          <button type="button" onClick={() => openDeal(deal.id)} className="w-full rounded-lg border bg-card p-3 text-left shadow-xs transition-colors hover:bg-accent/50">
            <span className="flex items-start gap-2">
              <SquareKanban className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[13px] font-medium">{deal.title}</span>
                <span className="tabular mt-0.5 block text-[13px] font-semibold">{formatMoney(deal.amount)}</span>
              </span>
            </span>
            <StageBadge stage={deal.stage} className="mt-2" />
          </button>
        ) : lead?.status === "disqualified" ? (
          <p className="text-[13px] text-muted-foreground">Лид отмечен как отказ.</p>
        ) : (
          <Button size="sm" className="w-full" onClick={createDeal} disabled={!lead && !client}>
            <Plus />
            Создать сделку
          </Button>
        )}
      </Section>

      <Section title="Ответственный">
        <MemberSelect value={conversation.ownerId ?? ""} onChange={(id) => assignConversation(conversation.id, id)} />
      </Section>

      <Section
        title="AI-сводка"
        action={<Sparkles className="size-3.5 text-primary" aria-hidden />}
      >
        <dl className="space-y-1.5 text-[13px]">
          {summary.facts.map((f) => (
            <div key={f.label} className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="min-w-0 break-words">{f.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 rounded-lg bg-primary-soft/60 px-3 py-2 text-[13px] leading-snug text-foreground">{summary.next}</p>
      </Section>

      <Section title="Быстрые действия">
        <div className="grid gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={() =>
              openDialog("task", {
                title: `Перезвонить: ${conversation.contactName}`,
                dueAt: tomorrow,
                dealId: deal?.id,
                clientId: client?.id,
                leadId: lead?.id,
                ownerId: conversation.ownerId ?? currentUserId,
              })
            }
          >
            <CalendarClock />
            Напомнить завтра в 10:00
          </Button>
          {client && (
            <Button asChild variant="outline" size="sm" className="justify-start">
              <Link href={`/clients/${client.id}`}>
                <UserRound />
                Профиль клиента
              </Link>
            </Button>
          )}
        </div>
      </Section>
    </div>
  );
}
