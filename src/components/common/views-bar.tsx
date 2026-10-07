"use client";

import * as React from "react";
import { BookmarkPlus, X } from "lucide-react";
import { toast } from "sonner";
import type { ViewEntity } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCrm } from "@/hooks/use-crm";
import { cn } from "@/lib/utils";

export type Filters = Record<string, string>;

export interface BuiltinView {
  id: string;
  name: string;
  /** значение главного фильтра, которое задаёт этот вид */
  value: string;
  count?: number;
}

const strip = (filters: Filters, defaults: Filters) => Object.fromEntries(Object.entries(filters).filter(([k, v]) => v !== defaults[k] && v !== ""));
const same = (a: Filters, b: Filters) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => (a[k] ?? "") === (b[k] ?? ""));
};

function Pill({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "group inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium outline-none transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/40",
        active ? "bg-card text-foreground shadow-card ring-1 ring-black/[0.04] dark:bg-accent dark:ring-white/[0.06]" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Быстрые виды списка: встроенные (по главному фильтру) и сохранённые пользователем.
 * Кнопка «Сохранить вид» появляется, только когда текущий набор фильтров ещё не сохранён.
 */
export function ViewsBar({
  entity,
  primaryKey,
  builtins,
  filters,
  defaults,
  onApply,
  className,
}: {
  entity: ViewEntity;
  primaryKey: string;
  builtins: BuiltinView[];
  filters: Filters;
  defaults: Filters;
  onApply: (filters: Filters) => void;
  className?: string;
}) {
  const views = useCrm((s) => s.views);
  const saveView = useCrm((s) => s.saveView);
  const deleteView = useCrm((s) => s.deleteView);
  const [name, setName] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const custom = views.filter((v) => v.entity === entity);
  const current = strip(filters, defaults);
  const activeCustom = custom.find((v) => same(v.filters, current));
  const exactBuiltin = builtins.some((b) => same(strip({ ...defaults, [primaryKey]: b.value }, defaults), current));
  const canSave = !activeCustom && !exactBuiltin;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    saveView({ entity, name: name.trim(), filters: current });
    toast.success(`Вид «${name.trim()}» сохранён`, { description: "Он доступен одним нажатием в этой строке" });
    setName("");
    setOpen(false);
  };

  return (
    <div role="radiogroup" aria-label="Виды списка" className={cn("no-scrollbar inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5", className)}>
      {builtins.map((b) => (
        <Pill key={b.id} active={!activeCustom && (filters[primaryKey] ?? defaults[primaryKey]) === b.value} onClick={() => onApply({ ...defaults, [primaryKey]: b.value })}>
          {b.name}
          {b.count !== undefined && <span className="tabular text-[11px] text-muted-foreground">{b.count}</span>}
        </Pill>
      ))}
      {custom.length > 0 && <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />}
      {custom.map((v) => (
        <Pill key={v.id} active={activeCustom?.id === v.id} onClick={() => onApply({ ...defaults, ...v.filters })} className="pr-1.5">
          {v.name}
          <span
            role="button"
            tabIndex={-1}
            aria-label={`Удалить вид «${v.name}»`}
            onClick={(e) => {
              e.stopPropagation();
              deleteView(v.id);
              toast("Вид удалён", { description: v.name });
            }}
            className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          >
            <X className="size-3" />
          </span>
        </Pill>
      ))}
      {canSave && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="xs" className="h-7 shrink-0 text-primary hover:text-primary">
              <BookmarkPlus />
              Сохранить вид
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72">
            <form onSubmit={save} className="space-y-3">
              <div>
                <p className="text-sm font-semibold">Сохранить текущие фильтры</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Вид появится рядом с остальными — для всей команды</p>
              </div>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, «Крупные в работе»" aria-label="Название вида" />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={name.trim().length < 2}>
                  Сохранить
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
