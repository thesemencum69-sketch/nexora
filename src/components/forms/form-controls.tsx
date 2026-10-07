"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import type { DealStageId, ID, LeadSource, Priority } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PriorityIcon, SourceIcon, StageDot } from "@/components/common/entity-meta";
import { UserAvatar } from "@/components/common/user-avatar";
import { PRIORITIES, SOURCES } from "@/lib/constants";
import { stageList } from "@/lib/stages";
import { useCrm } from "@/hooks/use-crm";
import { addDays, atTime } from "@/lib/time";
import { cn, matchesQuery } from "@/lib/utils";

/* ───────────── даты ───────────── */

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateInput(value: string | number) {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toTimeInput(value: string | number) {
  const d = new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromInputs(date: string, time = "18:00") {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, h ?? 18, min ?? 0).toISOString();
}

export function QuickDates({ options, onPick }: { options: { label: string; value: number }[]; onPick: (ms: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onPick(o.value)}
          className="h-6 rounded-full border bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:border-input hover:text-foreground"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const dueQuickOptions = (now: number) => [
  { label: "Сегодня, 18:00", value: atTime(now, 18) },
  { label: "Завтра, 10:00", value: atTime(addDays(now, 1), 10) },
  { label: "Через 3 дня", value: atTime(addDays(now, 3), 10) },
  { label: "Через неделю", value: atTime(addDays(now, 7), 10) },
];

export const closeQuickOptions = (now: number) => [
  { label: "Через неделю", value: atTime(addDays(now, 7), 18) },
  { label: "Через 2 недели", value: atTime(addDays(now, 14), 18) },
  { label: "Через месяц", value: atTime(addDays(now, 30), 18) },
];

/* ───────────── выбор сотрудника ───────────── */

export function MemberSelect({ id, value, onChange, invalid }: { id?: string; value: ID; onChange: (id: ID) => void; invalid?: boolean }) {
  const members = useCrm((s) => s.members);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-invalid={invalid}>
        <SelectValue placeholder="Выберите сотрудника" />
      </SelectTrigger>
      <SelectContent>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            <UserAvatar name={m.name} hue={m.hue} size="xs" />
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SourceSelect({ id, value, onChange }: { id?: string; value: LeadSource; onChange: (v: LeadSource) => void }) {
  return (
    <Select value={value} onValueChange={(v: LeadSource) => onChange(v)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SOURCES.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <SourceIcon source={s.id} />
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StageSelect({ id, value, onChange }: { id?: string; value: DealStageId; onChange: (v: DealStageId) => void }) {
  return (
    <Select value={value} onValueChange={(v: DealStageId) => onChange(v)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {stageList().map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <StageDot stage={s.id} />
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div role="radiogroup" aria-label="Приоритет" className="grid grid-cols-3 gap-1.5">
      {(["low", "medium", "high"] as const).map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          onClick={() => onChange(p)}
          className={cn(
            "flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
            value === p ? "border-foreground/20 bg-accent text-foreground shadow-xs" : "bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          <PriorityIcon priority={p} />
          {PRIORITIES[p].label}
        </button>
      ))}
    </div>
  );
}

/* ───────────── поиск сущности ───────────── */

export interface ComboItem {
  id: ID;
  label: string;
  sub?: string;
}

export function EntityCombobox({
  id,
  items,
  value,
  onChange,
  placeholder,
  emptyText = "Ничего не найдено",
  allowClear = false,
  invalid,
  footer,
}: {
  id?: string;
  items: ComboItem[];
  value: ID | null;
  onChange: (id: ID | null) => void;
  placeholder: string;
  emptyText?: string;
  allowClear?: boolean;
  invalid?: boolean;
  footer?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selected = items.find((i) => i.id === value);
  const filtered = React.useMemo(() => items.filter((i) => matchesQuery(query, i.label, i.sub)).slice(0, 50), [items, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className={cn("w-full justify-between px-3 font-normal aria-invalid:border-destructive", !selected && "text-muted-foreground")}
        >
          <span className="truncate">
            {selected ? (
              <>
                {selected.label}
                {selected.sub && <span className="ml-1.5 text-muted-foreground">{selected.sub}</span>}
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Поиск…" className="h-10 text-sm" />
          <CommandList className="max-h-64">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {allowClear && value && (
                <CommandItem
                  value="__clear"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  Не выбрано
                </CommandItem>
              )}
              {filtered.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    onChange(item.id);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.label}</span>
                    {item.sub && <span className="block truncate text-xs text-muted-foreground">{item.sub}</span>}
                  </span>
                  {item.id === value && <Check className="!text-foreground" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {footer && <div className="border-t p-1.5">{footer}</div>}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
