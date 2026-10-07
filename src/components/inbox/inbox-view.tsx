"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Inbox, MessagesSquare, Plug } from "lucide-react";
import Link from "next/link";
import type { Channel, ID } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/misc";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SourceIcon } from "@/components/common/entity-meta";
import { PageSkeleton } from "@/components/common/skeletons";
import { EmptyState } from "@/components/common/states";
import { SearchInput } from "@/components/common/table-parts";
import { useCrm, useNow, useReady } from "@/hooks/use-crm";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useMediaQuery } from "@/hooks/use-media-query";
import { LEAD_RESPONSE_SLA_MIN, SOURCE_BY_ID } from "@/lib/constants";
import { formatDuration, formatRelativeShort } from "@/lib/format";
import { cn, matchesQuery } from "@/lib/utils";
import { ChatThread, ThreadHeader } from "./chat-thread";
import { COMPOSER_ID } from "./composer";
import { ContextPanel } from "./context-panel";
import { ConversationAvatar } from "./conversation-avatar";
import { summarizeList, useMessagesByConversation } from "./use-inbox";

type Filter = "all" | "waiting" | "mine";

export function InboxView() {
  const ready = useReady();
  if (!ready) return <PageSkeleton variant="cards" />;
  return <InboxScreen />;
}

function InboxScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const conversations = useCrm((s) => s.conversations);
  const me = useCrm((s) => s.currentUserId);
  const byConversation = useMessagesByConversation();
  const now = useNow();
  const desktop = useMediaQuery("(min-width: 768px)", true);

  const [filter, setFilter] = React.useState<Filter>("all");
  const [channel, setChannel] = React.useState<Channel | "all">("all");
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<ID | null>(() => params.get("c"));
  const [contextOpen, setContextOpen] = React.useState(false);

  const rows = React.useMemo(() => {
    const sorted = [...conversations].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    return summarizeList(sorted, byConversation, now);
  }, [conversations, byConversation, now]);

  const counts = React.useMemo(
    () => ({ all: rows.length, waiting: rows.filter((r) => r.waiting > 0).length, mine: rows.filter((r) => r.conversation.ownerId === me).length }),
    [rows, me],
  );
  const channels = React.useMemo(() => {
    const map = new Map<Channel, number>();
    for (const r of rows) map.set(r.conversation.channel, (map.get(r.conversation.channel) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const visible = rows.filter(
    (r) =>
      (filter === "all" || (filter === "waiting" ? r.waiting > 0 : r.conversation.ownerId === me)) &&
      (channel === "all" || r.conversation.channel === channel) &&
      matchesQuery(query, r.conversation.contactName, r.conversation.handle, r.last?.text),
  );

  // на компьютере сразу открываем первый диалог — не нужно лишнего клика
  React.useEffect(() => {
    if (!desktop) return;
    if (!selectedId || !conversations.some((c) => c.id === selectedId)) setSelectedId(visible[0]?.conversation.id ?? null);
  }, [desktop, selectedId, conversations, visible]);

  const select = (id: ID | null) => {
    setSelectedId(id);
    router.replace(id ? `/inbox?c=${id}` : "/inbox", { scroll: false });
  };

  const move = (step: number) => {
    if (!visible.length) return;
    const index = visible.findIndex((r) => r.conversation.id === selectedId);
    const next = visible[Math.min(visible.length - 1, Math.max(0, index + step))] ?? visible[0];
    if (next) select(next.conversation.id);
  };

  useHotkeys([
    { combo: "j", handler: () => move(1) },
    { combo: "k", handler: () => move(-1) },
    { combo: "arrowdown", handler: () => move(1) },
    { combo: "arrowup", handler: () => move(-1) },
    { combo: "r", handler: () => document.getElementById(COMPOSER_ID)?.focus() },
  ]);

  const selected = conversations.find((c) => c.id === selectedId);
  const showList = desktop || !selected;

  if (!conversations.length) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={MessagesSquare}
          title="Здесь будет переписка с клиентами"
          description="Подключите Telegram, WhatsApp, MAX или форму на сайте — сообщения будут приходить сюда, а новые клиенты сами станут лидами."
          action={
            <Button asChild size="sm">
              <Link href="/settings/integrations">
                <Plug />
                Подключить каналы
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] md:grid-cols-[300px_minmax(0,1fr)] min-[87.5rem]:grid-cols-[320px_minmax(0,1fr)_300px]">
      {showList && (
        <aside className="flex min-h-0 flex-col border-r" aria-label="Диалоги">
          <div className="space-y-3 border-b px-4 pb-3 pt-4">
            <div className="flex items-baseline justify-between">
              <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Входящие</h1>
              <span className="hidden items-center gap-1 text-[11px] text-muted-foreground md:flex">
                <Kbd>J</Kbd>
                <Kbd>K</Kbd>
                переключение
              </span>
            </div>
            <div role="tablist" aria-label="Фильтр диалогов" className="grid grid-cols-3 gap-0.5 rounded-lg bg-muted p-0.5">
              {(
                [
                  ["all", "Все"],
                  ["waiting", "Ждут ответа"],
                  ["mine", "Мои"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    "flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-xs font-medium outline-none transition-[background-color,color] focus-visible:ring-2 focus-visible:ring-ring/40",
                    filter === value ? "bg-card text-foreground shadow-card dark:bg-accent" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                  <span className={cn("tabular text-[11px]", value === "waiting" && counts.waiting > 0 ? "font-semibold text-primary" : "text-muted-foreground")}>{counts[value]}</span>
                </button>
              ))}
            </div>
            <SearchInput value={query} onChange={setQuery} placeholder="Имя, контакт или текст" />
            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="group" aria-label="Каналы">
              <ChannelChip active={channel === "all"} onClick={() => setChannel("all")}>
                Все каналы
              </ChannelChip>
              {channels.map(([id, count]) => (
                <ChannelChip key={id} active={channel === id} onClick={() => setChannel(channel === id ? "all" : id)}>
                  <SourceIcon source={id} className="size-3" />
                  {SOURCE_BY_ID[id].label}
                  <span className="tabular text-muted-foreground">{count}</span>
                </ChannelChip>
              ))}
            </div>
          </div>

          <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2" aria-label="Список диалогов">
            {visible.length === 0 && (
              <li>
                <EmptyState compact icon={Inbox} title={filter === "waiting" ? "Все ответили" : "Ничего не нашли"} description={filter === "waiting" ? "Новые сообщения появятся здесь сразу." : "Попробуйте другой запрос или канал."} />
              </li>
            )}
            {visible.map(({ conversation, last, waiting }) => {
              const active = conversation.id === selectedId;
              const unread = conversation.unread > 0;
              const late = waiting >= LEAD_RESPONSE_SLA_MIN;
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => select(conversation.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                      active ? "bg-accent" : "hover:bg-accent/50",
                    )}
                  >
                    <ConversationAvatar conversation={conversation} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={cn("min-w-0 flex-1 truncate text-[14px]", unread ? "font-semibold" : "font-medium")}>{conversation.contactName}</span>
                        <span className={cn("tabular shrink-0 text-[11px]", unread ? "font-medium text-primary" : "text-muted-foreground")}>
                          {formatRelativeShort(conversation.lastMessageAt, now)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className={cn("line-clamp-1 min-w-0 flex-1 text-[13px]", unread ? "text-foreground" : "text-muted-foreground")}>
                          {last?.direction === "out" && <span className="text-muted-foreground">Вы: </span>}
                          {last?.text}
                        </span>
                        {unread && (
                          <span className="tabular flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
                            {conversation.unread}
                          </span>
                        )}
                      </span>
                      {waiting > 0 && (
                        <span
                          className={cn(
                            "mt-1.5 inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium",
                            late ? "bg-destructive/10 text-critical-text" : "bg-warning/15 text-warning-text",
                          )}
                        >
                          Ждёт ответа {formatDuration(waiting)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      )}

      {selected ? (
        <ChatThread
          key={selected.id}
          conversation={selected}
          className="h-full"
          header={<ThreadHeader conversation={selected} onBack={() => select(null)} onShowContext={() => setContextOpen(true)} />}
        />
      ) : (
        desktop && (
          <div className="flex items-center justify-center">
            <EmptyState icon={MessagesSquare} title="Выберите диалог" description="Слева все разговоры с клиентами из мессенджеров и сайта." />
          </div>
        )
      )}

      {selected && (
        <aside className="hidden min-h-0 border-l min-[87.5rem]:block" aria-label="О клиенте">
          <ContextPanel conversation={selected} />
        </aside>
      )}

      <Sheet open={contextOpen && Boolean(selected)} onOpenChange={setContextOpen}>
        <SheetContent side="right" className="w-[92vw] max-w-[360px] p-0 min-[87.5rem]:hidden" aria-describedby={undefined}>
          <SheetTitle className="sr-only">О клиенте</SheetTitle>
          {selected && <ContextPanel conversation={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ChannelChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
        active ? "border-primary/40 bg-primary-soft text-primary" : "bg-card text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
