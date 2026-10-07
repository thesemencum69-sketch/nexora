"use client";

import * as React from "react";
import { X } from "lucide-react";
import type { ID } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/misc";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Выбор строк: клик, Shift+клик для диапазона, «выбрать все на странице» */
export function useSelection(visibleIds: ID[]) {
  const [selected, setSelected] = React.useState<Set<ID>>(() => new Set());
  const anchor = React.useRef<ID | null>(null);

  // выбор живёт только среди видимых строк: сменили фильтр — лишнее снимается
  const visibleKey = visibleIds.join("|");
  React.useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(visibleIds);
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey]);

  const toggle = (id: ID, range = false) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (range && anchor.current) {
        const a = visibleIds.indexOf(anchor.current);
        const b = visibleIds.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [from, to] = a < b ? [a, b] : [b, a];
          for (const rowId of visibleIds.slice(from, to + 1)) next.add(rowId);
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      anchor.current = id;
      return next;
    });
  };

  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = !allSelected && visibleIds.some((id) => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visibleIds));
  const clear = () => setSelected(new Set());

  React.useEffect(() => {
    if (!selected.size) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector('[role="dialog"],[role="menu"]') && clear();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size]);

  return { selected, ids: [...selected], count: selected.size, toggle, toggleAll, clear, allSelected, someSelected };
}

export type Selection = ReturnType<typeof useSelection>;

export function SelectAllCheckbox({ selection, label = "Выбрать все на странице" }: { selection: Selection; label?: string }) {
  return (
    <Checkbox
      checked={selection.allSelected ? true : selection.someSelected ? "indeterminate" : false}
      onCheckedChange={() => selection.toggleAll()}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export function RowCheckbox({ selection, id, label }: { selection: Selection; id: ID; label: string }) {
  return (
    <span onClick={(e) => e.stopPropagation()} className="flex items-center">
      <Checkbox
        checked={selection.selected.has(id)}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          selection.toggle(id, e.shiftKey);
        }}
      />
    </span>
  );
}

/** Панель действий над выбранными строками: появляется снизу, только когда что-то отмечено */
export function BulkBar({ selection, noun, children }: { selection: Selection; noun: readonly [string, string, string]; children: React.ReactNode }) {
  if (!selection.count) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6">
      <div
        role="toolbar"
        aria-label="Действия с выбранными"
        className={cn("pointer-events-auto flex max-w-full animate-in fade-in-0 slide-in-from-bottom-2 items-center gap-1 overflow-x-auto rounded-2xl border bg-popover p-1.5 shadow-overlay duration-200")}
      >
        <span className="tabular whitespace-nowrap px-2.5 text-[13px] font-semibold">Выбрано: {formatCount(selection.count, noun)}</span>
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        {children}
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        <Button variant="ghost" size="icon-sm" onClick={selection.clear} aria-label="Снять выделение (Esc)">
          <X />
        </Button>
      </div>
    </div>
  );
}
