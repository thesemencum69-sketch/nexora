"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Bot, PanelRight, SquareKanban, UserRound } from "lucide-react";
import type { Conversation, Member, Message } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { SourceIcon, StageBadge } from "@/components/common/entity-meta";
import { useCrm, useMemberMap, useNow } from "@/hooks/use-crm";
import { formatDate } from "@/lib/format";
import { channelLabel } from "@/lib/inbox";
import { useUi } from "@/lib/store/ui-store";
import { calendarDaysBetween } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { ConversationAvatar } from "./conversation-avatar";
import { useConversationContext, useConversationMessages } from "./use-inbox";

const timeFmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

function dayLabel(iso: string, now: number) {
  const days = calendarDaysBetween(iso, now);
  if (days === 0) return "Сегодня";
  if (days === 1) return "Вчера";
  return formatDate(iso, now);
}

interface Group {
  key: string;
  direction: "in" | "out";
  author?: Member;
  auto?: boolean;
  messages: Message[];
}

/** Подряд идущие сообщения одного автора в пределах 10 минут — одна группа */
function groupMessages(messages: Message[], members: Map<string, Member>) {
  const days: { day: string; groups: Group[] }[] = [];
  for (const m of messages) {
    let bucket = days[days.length - 1];
    if (!bucket || bucket.day !== new Date(m.createdAt).toDateString()) {
      bucket = { day: new Date(m.createdAt).toDateString(), groups: [] };
      days.push(bucket);
    }
    const last = bucket.groups[bucket.groups.length - 1];
    const prev = last?.messages[last.messages.length - 1];
    if (last && last.direction === m.direction && last.author?.id === (m.authorId ?? undefined) && prev && Date.parse(m.createdAt) - Date.parse(prev.createdAt) < 10 * 60_000) {
      last.messages.push(m);
    } else {
      bucket.groups.push({ key: m.id, direction: m.direction, author: m.authorId ? members.get(m.authorId) : undefined, auto: m.auto, messages: [m] });
    }
  }
  return days;
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2" aria-live="polite" aria-label="Клиент печатает">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-3.5 py-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${i * 140}ms` }} />
        ))}
      </div>
    </div>
  );
}

export function ThreadHeader({
  conversation,
  onBack,
  onShowContext,
}: {
  conversation: Conversation;
  onBack?: () => void;
  onShowContext?: () => void;
}) {
  const { deal, client } = useConversationContext(conversation);
  const openDeal = useUi((s) => s.openDeal);
  return (
    <header className="flex items-center gap-3 border-b px-4 py-3 sm:px-6">
      {onBack && (
        <Button variant="ghost" size="icon-sm" className="-ml-2 md:hidden" onClick={onBack} aria-label="К списку диалогов">
          <ArrowLeft />
        </Button>
      )}
      <ConversationAvatar conversation={conversation} size="md" />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[15px] font-semibold leading-tight">{conversation.contactName}</h2>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" title={channelLabel(conversation)}>
          <SourceIcon source={conversation.channel} className="size-3" />
          <span className="truncate">{conversation.handle}</span>
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {deal ? (
          <button
            type="button"
            onClick={() => openDeal(deal.id)}
            className="hidden max-w-64 items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-left text-xs shadow-xs transition-colors hover:bg-accent sm:flex"
          >
            <SquareKanban className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{deal.title}</span>
            <StageBadge stage={deal.stage} className="h-5 px-2 text-[11px]" />
          </button>
        ) : null}
        {client && (
          <Hint label="Профиль клиента">
            <Button asChild variant="ghost" size="icon-sm">
              <Link href={`/clients/${client.id}`} aria-label="Профиль клиента">
                <UserRound />
              </Link>
            </Button>
          </Hint>
        )}
        {onShowContext && (
          <Hint label="Карточка клиента и AI-сводка">
            <Button variant="ghost" size="icon-sm" className="min-[87.5rem]:hidden" onClick={onShowContext} aria-label="Карточка клиента">
              <PanelRight />
            </Button>
          </Hint>
        )}
      </div>
    </header>
  );
}

/** Лента сообщений с полем ответа. Используется во «Входящих», карточке сделки и профиле клиента */
export function ChatThread({
  conversation,
  compact = false,
  header,
  className,
}: {
  conversation: Conversation;
  compact?: boolean;
  header?: React.ReactNode;
  className?: string;
}) {
  const messages = useConversationMessages(conversation.id);
  const typing = useCrm((s) => s.typingConversationId === conversation.id);
  const markRead = useCrm((s) => s.markConversationRead);
  const currentUserId = useCrm((s) => s.currentUserId);
  const members = useMemberMap();
  const now = useNow();
  const scroller = React.useRef<HTMLDivElement>(null);
  const days = React.useMemo(() => groupMessages(messages, members), [messages, members]);

  // открытый диалог считается прочитанным, в том числе когда приходят новые сообщения
  React.useEffect(() => {
    if (conversation.unread > 0) markRead(conversation.id);
  }, [conversation.id, conversation.unread, markRead]);

  React.useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation.id, messages.length, typing]);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {header}
      <div ref={scroller} className={cn("scrollbar-thin min-h-0 flex-1 overflow-y-auto", compact ? "px-3 py-3" : "px-4 py-5 sm:px-6")}>
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {days.map((day) => (
            <section key={day.day} className="flex flex-col gap-3" aria-label={dayLabel(day.groups[0]!.messages[0]!.createdAt, now)}>
              <div className="flex justify-center py-1">
                <span className="rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {dayLabel(day.groups[0]!.messages[0]!.createdAt, now)}
                </span>
              </div>
              {day.groups.map((group) => {
                const out = group.direction === "out";
                const showAuthor = out && group.author && group.author.id !== currentUserId;
                return (
                  <div key={group.key} className={cn("flex flex-col gap-1", out ? "items-end" : "items-start")}>
                    {(showAuthor || group.auto) && (
                      <span className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
                        {group.auto && <Bot className="size-3" />}
                        {group.auto ? "Автоматизация" : group.author?.name}
                      </span>
                    )}
                    {group.messages.map((m, i) => {
                      const lastInGroup = i === group.messages.length - 1;
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "max-w-[min(85%,560px)] whitespace-pre-wrap break-words px-3.5 py-2 text-[14px] leading-relaxed",
                            out ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                            out
                              ? cn("rounded-2xl", lastInGroup ? "rounded-br-md" : "rounded-br-lg")
                              : cn("rounded-2xl", lastInGroup ? "rounded-bl-md" : "rounded-bl-lg"),
                          )}
                        >
                          {m.text}
                        </div>
                      );
                    })}
                    <time className="px-1 text-[11px] text-muted-foreground/80" dateTime={group.messages[group.messages.length - 1]!.createdAt}>
                      {timeFmt.format(Date.parse(group.messages[group.messages.length - 1]!.createdAt))}
                    </time>
                  </div>
                );
              })}
            </section>
          ))}
          {typing && <TypingBubble />}
        </div>
      </div>
      <Composer conversation={conversation} messages={messages} compact={compact} />
    </div>
  );
}
