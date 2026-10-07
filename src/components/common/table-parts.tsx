"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

export function useSort<K extends string>(initial: SortState<K>) {
  const [sort, setSort] = React.useState(initial);
  const toggle = (key: K) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === initial.key ? initial.dir : "desc" }));
  return [sort, toggle] as const;
}

export function compareBy<T>(pick: (item: T) => string | number, dir: SortDir) {
  return (a: T, b: T) => {
    const x = pick(a);
    const y = pick(b);
    const result = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "ru");
    return dir === "asc" ? result : -result;
  };
}

export function SortHeader<K extends string>({
  label,
  title,
  column,
  sort,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  /** Полное название колонки, если в шапке стоит сокращённое */
  title?: string;
  column: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort.key === column;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("h-10 whitespace-nowrap px-3 text-xs font-medium text-muted-foreground", align === "right" ? "text-right" : "text-left", className)}
    >
      <button
        type="button"
        title={title}
        aria-label={title ? `${title}: сортировать` : undefined}
        onClick={() => onSort(column)}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded px-1 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
          active && "text-foreground",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-40")} />
      </button>
    </th>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th scope="col" className={cn("h-10 whitespace-nowrap px-3 text-left text-xs font-medium text-muted-foreground", className)}>{children}</th>;
}

export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 pl-9 pr-8 text-[13px]" aria-label={placeholder} />
      {value && (
        <button type="button" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Очистить поиск">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function usePagination<T>(items: T[], pageSize: number, resetKey: unknown) {
  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(pageSize);
  const pages = Math.max(1, Math.ceil(items.length / size));
  // ключ сериализуем, чтобы новый массив фильтров с теми же значениями не сбрасывал страницу
  const stableKey = JSON.stringify(resetKey ?? null);
  React.useEffect(() => setPage(1), [stableKey, size]);
  const current = Math.min(page, pages);
  return {
    page: current,
    pages,
    size,
    setSize,
    setPage,
    slice: items.slice((current - 1) * size, current * size),
    total: items.length,
  };
}

export function Pagination({
  page,
  pages,
  total,
  size,
  onPage,
  onSize,
  noun,
}: {
  page: number;
  pages: number;
  total: number;
  size: number;
  onPage: (p: number) => void;
  onSize: (s: number) => void;
  noun: string;
}) {
  const from = total ? (page - 1) * size + 1 : 0;
  const to = Math.min(total, page * size);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-[13px] text-muted-foreground">
      <span className="tabular">
        {formatNumber(from)}–{formatNumber(to)} из {formatNumber(total)} {noun}
      </span>
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline">На странице</span>
        <Select value={String(size)} onValueChange={(v) => onSize(Number(v))}>
          <SelectTrigger size="sm" className="w-[72px]" aria-label="Строк на странице">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 20, 50].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="tabular px-1">
          {page} / {pages}
        </span>
        <Button variant="outline" size="icon-sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Предыдущая страница">
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Следующая страница">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
