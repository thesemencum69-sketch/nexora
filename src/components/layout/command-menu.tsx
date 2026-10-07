"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { CircleCheck, FileUp, Keyboard, ListChecks, Magnet, Moon, SquareKanban, Target, UserPlus, Users } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/misc";
import { StageDot } from "@/components/common/entity-meta";
import { UserAvatar } from "@/components/common/user-avatar";
import { SETTINGS_SECTIONS } from "@/config/settings";
import { useCrm, useClientMap } from "@/hooks/use-crm";
import { accountName } from "@/lib/display";
import { formatMoney } from "@/lib/format";
import { isOpen } from "@/lib/metrics";
import { useUi } from "@/lib/store/ui-store";
import { matchesQuery } from "@/lib/utils";
import { ALL_NAV } from "./nav-config";

const LIMIT = 5;

function Shortcut({ keys }: { keys?: string }) {
  if (!keys) return null;
  return (
    <span className="ml-auto flex gap-0.5">
      {keys.split(" ").map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </span>
  );
}

/** ⌘K: поиск по всей CRM и быстрые действия с клавиатуры */
export function CommandMenu() {
  const { commandOpen, setCommandOpen, openDialog, openDeal, setShortcutsOpen } = useUi();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = React.useState("");
  const clients = useCrm((s) => s.clients);
  const deals = useCrm((s) => s.deals);
  const leads = useCrm((s) => s.leads);
  const tasks = useCrm((s) => s.tasks);
  const clientMap = useClientMap();

  React.useEffect(() => {
    if (!commandOpen) setQuery("");
  }, [commandOpen]);

  const results = React.useMemo(() => {
    const q = query.trim();
    if (!q) {
      return {
        clients: clients.slice(0, 4),
        deals: deals.filter(isOpen).sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)).slice(0, 4),
        leads: [],
        tasks: [],
      };
    }
    return {
      clients: clients.filter((c) => matchesQuery(q, c.name, c.company, c.email, c.phone)).slice(0, LIMIT),
      deals: deals.filter((d) => matchesQuery(q, d.title, clientMap.get(d.clientId)?.company, clientMap.get(d.clientId)?.name)).slice(0, LIMIT),
      leads: leads.filter((l) => matchesQuery(q, l.name, l.company, l.phone, l.email)).slice(0, LIMIT),
      tasks: tasks.filter((t) => t.status === "open" && matchesQuery(q, t.title, t.description)).slice(0, LIMIT),
    };
  }, [query, clients, deals, leads, tasks, clientMap]);

  const go = (href: string) => {
    setCommandOpen(false);
    router.push(href);
  };

  const actions = [
    { label: "Создать сделку", icon: SquareKanban, keys: "N", run: () => openDialog("deal") },
    { label: "Добавить лида", icon: Magnet, keys: "L", run: () => openDialog("lead") },
    { label: "Добавить клиента", icon: UserPlus, keys: "C", run: () => openDialog("client") },
    { label: "Поставить задачу", icon: ListChecks, keys: "T", run: () => openDialog("task") },
    { label: "Импорт из Excel или CSV", icon: FileUp, run: () => go("/settings/import") },
    { label: "План продаж на месяц", icon: Target, run: () => go("/team") },
    {
      label: resolvedTheme === "dark" ? "Включить светлую тему" : "Включить тёмную тему",
      icon: Moon,
      run: () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        setCommandOpen(false);
      },
    },
    {
      label: "Горячие клавиши",
      icon: Keyboard,
      keys: "?",
      run: () => {
        setCommandOpen(false);
        setShortcutsOpen(true);
      },
    },
  ].filter((a) => matchesQuery(query, a.label));

  const nav = ALL_NAV.filter((n) => matchesQuery(query, n.label));
  const settings = query ? SETTINGS_SECTIONS.filter((s) => matchesQuery(query, s.label, s.description)) : [];

  return (
    <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
      <DialogContent hideClose className="top-[12dvh] max-w-[640px] translate-y-0 gap-0 overflow-hidden p-0 sm:top-[14dvh]">
        <DialogTitle className="sr-only">Поиск и команды</DialogTitle>
        <DialogDescription className="sr-only">Ищите клиентов, сделки, лиды, задачи и настройки</DialogDescription>
        <Command shouldFilter={false} loop>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Найти клиента, сделку, лида или команду…" />
          <CommandList>
            <CommandEmpty>Ничего не нашлось по запросу «{query}»</CommandEmpty>

            {actions.length > 0 && (
              <CommandGroup heading="Действия">
                {actions.map((a) => (
                  <CommandItem key={a.label} value={`action-${a.label}`} onSelect={a.run}>
                    <a.icon />
                    {a.label}
                    <Shortcut keys={a.keys} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.clients.length > 0 && (
              <CommandGroup heading={query ? "Клиенты" : "Недавние клиенты"}>
                {results.clients.map((c) => (
                  <CommandItem key={c.id} value={`client-${c.id}`} onSelect={() => go(`/clients/${c.id}`)}>
                    <UserAvatar name={c.name} size="sm" />
                    <span className="truncate">{c.name}</span>
                    <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">{c.company || "Частное лицо"}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.deals.length > 0 && (
              <CommandGroup heading={query ? "Сделки" : "Сделки в работе"}>
                {results.deals.map((d) => (
                  <CommandItem
                    key={d.id}
                    value={`deal-${d.id}`}
                    onSelect={() => {
                      go("/deals");
                      openDeal(d.id);
                    }}
                  >
                    <StageDot stage={d.stage} className="mx-1" />
                    <span className="truncate">{d.title}</span>
                    <span className="truncate text-xs text-muted-foreground">{accountName(clientMap.get(d.clientId))}</span>
                    <span className="tabular ml-auto pl-3 text-xs font-medium">{formatMoney(d.amount)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.leads.length > 0 && (
              <CommandGroup heading="Лиды">
                {results.leads.map((l) => (
                  <CommandItem key={l.id} value={`lead-${l.id}`} onSelect={() => go(`/leads?q=${encodeURIComponent(l.name)}`)}>
                    <Magnet />
                    <span className="truncate">{l.name}</span>
                    <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">{l.company}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.tasks.length > 0 && (
              <CommandGroup heading="Задачи">
                {results.tasks.map((t) => (
                  <CommandItem key={t.id} value={`task-${t.id}`} onSelect={() => go(`/tasks?q=${encodeURIComponent(t.title)}`)}>
                    <CircleCheck />
                    <span className="truncate">{t.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {nav.length > 0 && (
              <CommandGroup heading="Перейти">
                {nav.map((n) => (
                  <CommandItem key={n.href} value={`nav-${n.href}`} onSelect={() => go(n.href)}>
                    <n.icon />
                    {n.label}
                    <Shortcut keys={n.shortcut} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {settings.length > 0 && (
              <CommandGroup heading="Настройки">
                {settings.map((s) => (
                  <CommandItem key={s.id} value={`settings-${s.id}`} onSelect={() => go(`/settings/${s.id}`)}>
                    <s.icon />
                    {s.label}
                    <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">{s.description}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!query && (
              <CommandGroup heading="Команда">
                <CommandItem value="team" onSelect={() => go("/team")}>
                  <Users />
                  Сотрудники и роли
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
          <div className="flex items-center gap-4 border-t px-4 py-2.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              выбрать
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd>
              открыть
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <Kbd>esc</Kbd>
              закрыть
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
