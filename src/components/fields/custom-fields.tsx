"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { CustomField, CustomFieldEntity, CustomFieldType, CustomValues, ID } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrm } from "@/hooks/use-crm";
import { cn } from "@/lib/utils";

export const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Текст" },
  { value: "number", label: "Число" },
  { value: "select", label: "Список" },
  { value: "date", label: "Дата" },
];

const NONE = "__none";
const inlineInput = "h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input focus-visible:bg-card";

/** Редактор значения своего поля: сохраняется сразу, без кнопки «Сохранить» */
export function FieldEditor({ field, value, onChange, className }: { field: CustomField; value: string; onChange: (value: string) => void; className?: string }) {
  const [draft, setDraft] = React.useState(value);
  const [focused, setFocused] = React.useState(false);
  React.useEffect(() => setDraft(value), [value]);
  // числа показываем с разрядами, а редактируем как есть
  const numeric = field.type === "number" && !focused && draft.trim() !== "" && Number.isFinite(Number(draft.replace(/\s/g, "").replace(",", ".")));
  const shown = numeric ? Number(draft.replace(/\s/g, "").replace(",", ".")).toLocaleString("ru-RU") : draft;
  const commit = () => {
    if (draft.trim() !== value) onChange(draft);
  };

  if (field.type === "select") {
    return (
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
        <SelectTrigger className={cn(inlineInput, "w-full", !value && "text-muted-foreground", className)} aria-label={field.label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Не выбрано</SelectItem>
          {(field.options ?? []).map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      type={field.type === "date" ? "date" : "text"}
      inputMode={field.type === "number" ? "decimal" : undefined}
      value={shown}
      placeholder="Не указано"
      onFocus={() => setFocused(true)}
      aria-label={field.label}
      onChange={(e) => setDraft(field.type === "number" ? e.target.value.replace(/[^\d.,\s-]/g, "") : e.target.value)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      className={cn(inlineInput, field.type === "number" && "tabular", className)}
    />
  );
}

/** Создание поля прямо там, где оно понадобилось: в карточке сделки или клиента */
export function AddFieldButton({ entity, className }: { entity: CustomFieldEntity; className?: string }) {
  const addCustomField = useCrm((s) => s.addCustomField);
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [type, setType] = React.useState<CustomFieldType>("text");
  const [options, setOptions] = React.useState("");

  const reset = () => {
    setLabel("");
    setType("text");
    setOptions("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const list = options
      .split(/\n|,/)
      .map((o) => o.trim())
      .filter(Boolean);
    if (label.trim().length < 2 || (type === "select" && !list.length)) return;
    addCustomField({ entity, label: label.trim(), type, options: type === "select" ? [...new Set(list)] : undefined });
    toast.success(`Поле «${label.trim()}» добавлено`, { description: entity === "deal" ? "Оно появится во всех сделках" : "Оно появится у всех клиентов" });
    reset();
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="subtle" size="xs" className={className}>
          <Plus />
          Добавить поле
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Новое поле</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{entity === "deal" ? "Появится во всех сделках" : "Появится у всех клиентов"}</p>
          </div>
          <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Например, «Бюджет на рекламу»" aria-label="Название поля" />
          <Segmented size="sm" value={type} onValueChange={setType} options={FIELD_TYPES} aria-label="Тип поля" className="w-full" />
          {type === "select" && (
            <Textarea value={options} onChange={(e) => setOptions(e.target.value)} rows={3} placeholder={"Варианты — каждый с новой строки\nОнлайн\nОчно"} aria-label="Варианты списка" />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" size="sm" disabled={label.trim().length < 2 || (type === "select" && !options.trim())}>
              Добавить
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Свои поля сущности в виде строк «название — значение» */
export function CustomFieldRows({
  entity,
  entityId,
  values,
  labelClassName = "w-[132px]",
}: {
  entity: CustomFieldEntity;
  entityId: ID;
  values: CustomValues | undefined;
  labelClassName?: string;
}) {
  const fields = useCrm((s) => s.customFields);
  const setCustomValue = useCrm((s) => s.setCustomValue);
  const list = React.useMemo(() => fields.filter((f) => f.entity === entity), [fields, entity]);
  return (
    <>
      {list.map((field) => (
        <div key={field.id} className="flex items-center gap-3 py-0.5">
          <span className={cn("shrink-0 truncate text-[13px] text-muted-foreground", labelClassName)} title={field.label}>
            {field.label}
          </span>
          <div className="-ml-2 min-w-0 flex-1 text-[13px]">
            <FieldEditor field={field} value={values?.[field.id] ?? ""} onChange={(v) => setCustomValue(entity, entityId, field.id, v)} />
          </div>
        </div>
      ))}
    </>
  );
}
