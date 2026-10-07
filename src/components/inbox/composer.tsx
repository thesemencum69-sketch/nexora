"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, SendHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Conversation, Message } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Hint } from "@/components/ui/tooltip";
import { useCrm, useCurrentUser, useNow } from "@/hooks/use-crm";
import { channelLabel, draftReply, fillTemplate, firstName } from "@/lib/inbox";
import { cn } from "@/lib/utils";
import { useAssistContext } from "./use-inbox";

export const COMPOSER_ID = "inbox-composer";

/**
 * Поле ответа. Enter — отправить, Shift+Enter — новая строка,
 * «/» в начале — быстрый поиск по шаблонам, AI предлагает черновик.
 */
export function Composer({ conversation, messages, compact = false }: { conversation: Conversation; messages: Message[]; compact?: boolean }) {
  const [text, setText] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [templatesOpen, setTemplatesOpen] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const templates = useCrm((s) => s.replyTemplates);
  const workspaceName = useCrm((s) => s.workspace.name);
  const sendMessage = useCrm((s) => s.sendMessage);
  const me = useCurrentUser();
  const now = useNow();
  const assist = useAssistContext(conversation, messages, now);

  // черновик на диалог: переключились и вернулись — текст на месте
  const drafts = React.useRef(new Map<string, string>());
  React.useEffect(() => {
    setText(drafts.current.get(conversation.id) ?? "");
    setActive(0);
  }, [conversation.id]);
  const update = (value: string) => {
    drafts.current.set(conversation.id, value);
    setText(value);
  };

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, compact ? 140 : 180)}px`;
  }, [text, compact]);

  const vars = { name: firstName(conversation.contactName), manager: firstName(me?.name ?? ""), company: workspaceName };
  const slash = text.startsWith("/") ? text.slice(1).trim().toLowerCase() : null;
  const suggestions = slash === null ? [] : templates.filter((t) => !slash || t.title.toLowerCase().includes(slash) || t.body.toLowerCase().includes(slash)).slice(0, 6);

  const focusEnd = () =>
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });

  const insertTemplate = (body: string) => {
    update(fillTemplate(body, vars));
    setTemplatesOpen(false);
    focusEnd();
  };

  const submit = () => {
    if (!text.trim() || slash !== null) return;
    sendMessage(conversation.id, text);
    update("");
  };

  const aiDraft = () => {
    const previous = text;
    update(draftReply(assist));
    focusEnd();
    toast("Черновик готов — проверьте и отправьте", {
      description: "AI учёл историю переписки и этап сделки",
      action: previous.trim() ? { label: "Вернуть мой текст", onClick: () => update(previous) } : undefined,
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (suggestions.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertTemplate(suggestions[Math.min(active, suggestions.length - 1)]!.body);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        update("");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") e.currentTarget.blur();
  };

  return (
    <div className={cn("relative border-t bg-background", compact ? "p-2.5" : "px-4 pb-4 pt-3 sm:px-6")}>
      {suggestions.length > 0 && (
        <div className="absolute inset-x-3 bottom-full z-10 mb-2 overflow-hidden rounded-xl border bg-popover p-1 shadow-overlay sm:inset-x-6" role="listbox" aria-label="Шаблоны ответов">
          <p className="px-2.5 pb-1 pt-1.5 text-xs text-muted-foreground">Шаблоны — ↑↓ выбрать, Enter вставить</p>
          {suggestions.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertTemplate(t.body)}
              className={cn("block w-full rounded-lg px-2.5 py-2 text-left", i === active && "bg-accent")}
            >
              <span className="block text-[13px] font-medium">{t.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{fillTemplate(t.body, vars)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="rounded-xl border bg-card shadow-xs transition-[border-color,box-shadow] focus-within:border-ring/50 focus-within:ring-[3px] focus-within:ring-ring/15">
        <textarea
          id={compact ? undefined : COMPOSER_ID}
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => {
            update(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={`Ответить в ${channelLabel(conversation)}… «/» — шаблоны`}
          aria-label="Текст сообщения"
          className="block w-full resize-none bg-transparent px-3.5 pt-3 text-[14px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
        />
        <div className="flex items-center gap-1 px-2 pb-2 pt-1">
          <Popover open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <PopoverTrigger asChild>
              <Button variant="subtle" size="xs" aria-label="Шаблоны ответов">
                <FileText />
                <span className="hidden sm:inline">Шаблоны</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" side="top" className="w-[min(92vw,380px)] p-1">
              {templates.length ? (
                <div className="max-h-72 overflow-y-auto">
                  {templates.map((t) => (
                    <button key={t.id} type="button" onClick={() => insertTemplate(t.body)} className="block w-full rounded-lg px-2.5 py-2 text-left hover:bg-accent">
                      <span className="block text-[13px] font-medium">{t.title}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{fillTemplate(t.body, vars)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">Шаблонов пока нет</p>
              )}
              <div className="mt-1 border-t px-2.5 py-2">
                <Link href="/settings/templates" className="text-xs font-medium text-primary hover:underline" onClick={() => setTemplatesOpen(false)}>
                  Настроить шаблоны
                </Link>
              </div>
            </PopoverContent>
          </Popover>
          <Hint label="Предложить ответ по истории диалога">
            <Button variant="subtle" size="xs" onClick={aiDraft}>
              <Sparkles className="text-primary" />
              <span className="hidden sm:inline">AI-черновик</span>
            </Button>
          </Hint>
          <Hint label="Отправить" shortcut="Enter">
            <Button size="icon-sm" className="ml-auto rounded-lg" onClick={submit} disabled={!text.trim() || slash !== null} aria-label="Отправить">
              <SendHorizontal />
            </Button>
          </Hint>
        </div>
      </div>
    </div>
  );
}
