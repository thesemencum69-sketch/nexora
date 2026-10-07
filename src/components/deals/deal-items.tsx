"use client";

import * as React from "react";
import { Package, Plus, X } from "lucide-react";
import type { Deal, DealItem } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCrm } from "@/hooks/use-crm";
import { formatMoney } from "@/lib/format";
import { itemsTotal } from "@/lib/store/slices/documents";
import { cn, uid } from "@/lib/utils";

const cell = "h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-[13px] outline-none transition-colors hover:border-input focus:border-input focus:bg-card";

function NumberCell({ value, onChange, label, className }: { value: number; onChange: (v: number) => void; label: string; className?: string }) {
  const [draft, setDraft] = React.useState(String(value));
  const [focused, setFocused] = React.useState(false);
  React.useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      // вне фокуса — с разрядами, как в документах; при вводе — просто цифры
      value={focused ? draft : value.toLocaleString("ru-RU")}
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, ""))}
      onBlur={() => {
        setFocused(false);
        const next = Number(draft.replace(",", "."));
        if (Number.isFinite(next) && next >= 0 && next !== value) onChange(next);
        else setDraft(String(value));
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={cn(cell, "tabular text-right", className)}
    />
  );
}

/** Товары и услуги сделки: сумма сделки пересчитывается сама */
export function DealItems({ deal }: { deal: Deal }) {
  const products = useCrm((s) => s.products);
  const setDealItems = useCrm((s) => s.setDealItems);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const items = deal.items ?? [];

  const save = (next: DealItem[]) => setDealItems(deal.id, next);
  const patch = (id: string, change: Partial<DealItem>) => save(items.map((i) => (i.id === id ? { ...i, ...change } : i)));
  const add = (item: Omit<DealItem, "id">) => {
    // первая позиция по умолчанию берёт текущую сумму сделки, чтобы она не обнулилась
    const base = items.length === 0 && item.productId === null ? { ...item, price: deal.amount } : item;
    save([...items, { id: uid("item"), ...base }]);
    setPickerOpen(false);
  };

  return (
    <section aria-label="Товары и услуги">
      <div className="mb-1.5 flex items-center gap-2">
        <h3 className="text-[13px] font-medium">Товары и услуги</h3>
        {items.length > 0 && <span className="tabular ml-auto text-[13px] font-semibold">{formatMoney(itemsTotal(items))}</span>}
      </div>

      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[minmax(0,1fr)_64px_104px_28px] items-center gap-1 border-b bg-muted/40 px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="px-2">Позиция</span>
            <span className="px-2 text-right">Кол-во</span>
            <span className="px-2 text-right">Цена, ₽</span>
            <span />
          </div>
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="group grid grid-cols-[minmax(0,1fr)_64px_104px_28px] items-center gap-1 px-2 py-1">
                <input
                  aria-label="Название позиции"
                  defaultValue={item.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== item.name && patch(item.id, { name: e.target.value.trim() })}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className={cn(cell, "truncate")}
                />
                <NumberCell label="Количество" value={item.qty} onChange={(qty) => patch(item.id, { qty: qty || 1 })} />
                <NumberCell label="Цена" value={item.price} onChange={(price) => patch(item.id, { price })} />
                <button
                  type="button"
                  onClick={() => save(items.filter((i) => i.id !== item.id))}
                  aria-label={`Удалить «${item.name}»`}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={cn("flex flex-wrap items-center gap-1", items.length > 0 && "mt-1.5")}>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant={items.length ? "subtle" : "outline"} size="xs">
              <Package />
              {items.length ? "Добавить из каталога" : "Добавить товар или услугу"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <Command>
              <CommandInput placeholder="Найти в каталоге…" />
              <CommandList className="max-h-64">
                <CommandEmpty>Ничего не нашли</CommandEmpty>
                <CommandGroup heading="Каталог">
                  {products.map((p) => (
                    <CommandItem key={p.id} value={`${p.name} ${p.price}`} onSelect={() => add({ productId: p.id, name: p.name, price: p.price, qty: 1, unit: p.unit })}>
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className="tabular text-xs text-muted-foreground">
                        {formatMoney(p.price)} / {p.unit}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button variant="subtle" size="xs" onClick={() => add({ productId: null, name: items.length ? "Новая позиция" : deal.title, price: 0, qty: 1, unit: "шт." })}>
          <Plus />
          Своя позиция
        </Button>
        {items.length === 0 && <span className="text-xs text-muted-foreground">Сумма сделки посчитается сама</span>}
      </div>
    </section>
  );
}
