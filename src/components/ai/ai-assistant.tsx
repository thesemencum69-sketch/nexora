"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUp, CircleCheck, Lightbulb, ListChecks, RotateCcw, Sparkles, TrendingUp, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/common/skeletons";
import { UserAvatar } from "@/components/common/user-avatar";
import { useCrm, useCurrentUser, useNow, useReady } from "@/hooks/use-crm";
import { SUGGESTIONS, answer, insights, type AiAnswer, type AiBlock, type AiContext } from "@/lib/ai/mock-assistant";
import { useUi } from "@/lib/store/ui-store";
import { HOUR, atTime, addDays } from "@/lib/time";
import { cn, uid } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  text?: string;
  answer?: AiAnswer;
}

function useAiContext(): AiContext {
  const deals = useCrm((s) => s.deals);
  const leads = useCrm((s) => s.leads);
  const tasks = useCrm((s) => s.tasks);
  const clients = useCrm((s) => s.clients);
  const members = useCrm((s) => s.members);
  const now = useNow();
  return React.useMemo(() => ({ deals, leads, tasks, clients, members, now }), [deals, leads, tasks, clients, members, now]);
}

function Block({ block, onAction, done }: { block: AiBlock; onAction: (block: Extract<AiBlock, { type: "action" }>) => void; done: boolean }) {
  const openDeal = useUi((s) => s.openDeal);
  switch (block.type) {
    case "text":
      return <p className="text-[14.5px] leading-relaxed">{block.text}</p>;
    case "metrics":
      return (
        <div className="grid grid-cols-3 gap-2">
          {block.items.map((m) => (
            <div key={m.label} className="rounded-lg border bg-card px-3 py-2.5">
              <div className="text-xs text-muted-foreground">{m.label}</div>
              <div className="mt-0.5 text-[17px] font-semibold">{m.value}</div>
              {m.delta && <div className={cn("text-xs", m.good === false ? "text-critical-text" : "text-muted-foreground")}>{m.delta}</div>}
            </div>
          ))}
        </div>
      );
    case "list":
      return (
        <div>
          {block.title && <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">{block.title}</h4>}
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {block.items.map((item, i) => {
              const content = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{item.title}</span>
                    {item.subtitle && <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>}
                  </span>
                  {item.badge && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        item.tone === "critical" ? "bg-destructive/10 text-critical-text" : item.tone === "warning" ? "bg-warning/15 text-warning-text" : "bg-muted text-foreground",
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              );
              const cls = "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50";
              return (
                <li key={i}>
                  {item.dealId ? (
                    <button type="button" className={cls} onClick={() => openDeal(item.dealId!)}>
                      {content}
                    </button>
                  ) : item.href ? (
                    <Link href={item.href} className={cls}>
                      {content}
                    </Link>
                  ) : (
                    <div className={cls}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      );
    case "action":
      return done ? (
        <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-success-text">
          <CircleCheck className="size-4" />
          Готово: задачи поставлены ответственным
        </p>
      ) : (
        <Button size="sm" onClick={() => onAction(block)}>
          <ListChecks />
          {block.label}
        </Button>
      );
  }
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-2" aria-label="Ассистент печатает">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </span>
  );
}

export function AiAssistant() {
  const ready = useReady();
  if (!ready) return <PageSkeleton variant="form" />;
  return <Assistant />;
}

function Assistant() {
  const ctx = useAiContext();
  const user = useCurrentUser();
  const createTask = useCrm((s) => s.createTask);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const [doneActions, setDoneActions] = React.useState<Set<string>>(new Set());
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const cards = React.useMemo(() => insights(ctx), [ctx]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const ask = (question: string) => {
    const text = question.trim();
    if (!text || thinking) return;
    setMessages((m) => [...m, { id: uid("msg"), role: "user", text }]);
    setInput("");
    setThinking(true);
    window.setTimeout(() => {
      setMessages((m) => [...m, { id: uid("msg"), role: "assistant", answer: answer(text, ctx) }]);
      setThinking(false);
    }, 650 + Math.random() * 450);
  };

  const runAction = (messageId: string, block: Extract<AiBlock, { type: "action" }>) => {
    const now = Date.now();
    const due = atTime(addDays(now, 0), Math.min(19, new Date(now).getHours() + 1));
    if (block.id === "tasks_for_leads") {
      for (const leadId of block.payload) {
        const lead = ctx.leads.find((l) => l.id === leadId);
        if (!lead) continue;
        createTask({
          title: `Связаться: ${lead.name}`,
          description: `Заявка ${lead.company ? `от ${lead.company} ` : ""}ждёт ответа. Задача создана AI-ассистентом.`,
          assigneeId: lead.ownerId ?? ctx.members[0]!.id,
          dueAt: new Date(Math.max(due, now + HOUR)).toISOString(),
          priority: "high",
          dealId: null,
          clientId: lead.clientId,
          leadId: lead.id,
        });
      }
    } else {
      for (const dealId of block.payload) {
        const deal = ctx.deals.find((d) => d.id === dealId);
        if (!deal) continue;
        createTask({
          title: "Вернуть сделку в работу: созвониться с клиентом",
          description: `«${deal.title}». Задача создана AI-ассистентом.`,
          assigneeId: deal.ownerId,
          dueAt: new Date(atTime(addDays(now, 1), 11)).toISOString(),
          priority: "high",
          dealId: deal.id,
          clientId: deal.clientId,
        });
      }
    }
    setDoneActions((s) => new Set(s).add(messageId));
    toast.success(`Поставлено задач: ${block.payload.length}`, { description: "Ответственные увидят их в разделе «Задачи»" });
  };

  const empty = messages.length === 0;

  return (
    <div className="animate-page grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="flex min-h-[calc(100dvh-10rem)] flex-col overflow-hidden rounded-2xl border bg-card shadow-card md:min-h-[calc(100dvh-8.5rem)]">
        <header className="flex items-center gap-3 border-b px-5 py-3.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold">AI-ассистент</h1>
            <p className="text-xs text-muted-foreground">Отвечает по данным вашей CRM</p>
          </div>
          {!empty && (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setMessages([])}>
              <RotateCcw />
              Новый диалог
            </Button>
          )}
        </header>

        <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          {empty ? (
            <div className="mx-auto flex h-full max-w-xl flex-col justify-center py-8">
              <h2 className="text-[26px] font-semibold tracking-[-0.025em]">Чем помочь, {user?.name.split(" ")[0]}?</h2>
              <p className="mt-2 text-[15px] text-muted-foreground">
                Спросите о продажах, клиентах или команде. Ассистент найдёт проблему, объяснит цифры и сам поставит задачи.
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="rounded-xl border bg-background px-3.5 py-3 text-left text-[13.5px] outline-none transition-colors hover:border-input hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-6">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-[14.5px]">{m.text}</p>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-3">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <Sparkles className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 animate-page space-y-3">
                      {m.answer!.blocks.map((block, i) => (
                        <Block key={i} block={block} done={doneActions.has(m.id)} onAction={(b) => runAction(m.id, b)} />
                      ))}
                      {m.answer!.followUps.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {m.answer!.followUps.map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => ask(f)}
                              className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-input hover:text-foreground"
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}
              {thinking && (
                <div className="flex gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Sparkles className="size-3.5" />
                  </span>
                  <TypingDots />
                </div>
              )}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="border-t bg-background/60 p-3 sm:p-4"
        >
          <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-xl border bg-card p-2 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/15">
            <UserAvatar name={user?.name ?? "Вы"} hue={user?.hue} size="sm" className="mb-1 ml-1 hidden sm:inline-flex" />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              placeholder="Например: какие сделки под риском?"
              aria-label="Вопрос ассистенту"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-1.5 py-2 text-[14.5px] outline-none placeholder:text-muted-foreground"
            />
            <Button type="submit" size="icon-sm" disabled={!input.trim() || thinking} aria-label="Отправить">
              <ArrowUp />
            </Button>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] text-muted-foreground">
            Демо-режим: ответы собираются из данных CRM без внешней модели. Подключение языковой модели — в разделе интеграций.
          </p>
        </form>
      </section>

      <aside className="space-y-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Lightbulb className="size-4 text-primary" />
          Наблюдения
        </h2>
        {cards.map((c) => (
          <button
            key={c.title}
            type="button"
            onClick={() => ask(c.prompt)}
            className="block w-full rounded-xl border bg-card p-4 text-left shadow-card outline-none transition-shadow hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <span className="flex items-start gap-2.5">
              {c.tone === "warning" ? (
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-text" />
              ) : (
                <TrendingUp className="mt-0.5 size-4 shrink-0 text-success-text" />
              )}
              <span>
                <span className="block text-[13.5px] font-semibold">{c.title}</span>
                <span className="mt-0.5 block text-[13px] text-muted-foreground">{c.text}</span>
                <span className="mt-2 block text-xs font-medium text-primary">Спросить подробнее</span>
              </span>
            </span>
          </button>
        ))}
      </aside>
    </div>
  );
}
