"use client";

import * as React from "react";
import Link from "next/link";
import { CircleCheck, FileSpreadsheet, Loader2, RotateCcw, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrm } from "@/hooks/use-crm";
import { formatCount } from "@/lib/format";
import { TARGETS, autoMap, detectSource, guessEntity, prepareImport, type ImportEntity, type Mapping } from "@/lib/import/mapping";
import { parseFile, type ParsedTable } from "@/lib/import/parse";
import { cn } from "@/lib/utils";

const NONE = "__none";
const SAMPLE_CSV = "Имя;Компания;Телефон;Email;Город;Источник;Название сделки;Сумма;Этап\nИрина Котова;Клиника «Улыбка»;+7 916 555-12-34;irina@ulybka.ru;Москва;Сайт;Сайт для клиники;180000;Предложение\n";

type Step = { kind: "upload" } | { kind: "loading"; fileName: string } | { kind: "map"; fileName: string; table: ParsedTable } | { kind: "done"; fileName: string; batchId: string; summary: string };

/**
 * Импорт в три шага: перетащить файл → проверить, как Nexora поняла колонки → импортировать.
 * Колонки из amoCRM, Битрикс24 и обычных таблиц сопоставляются сами.
 */
export function ImportWizard({ inline = false, defaultEntity, onDone }: { inline?: boolean; defaultEntity?: ImportEntity; onDone?: () => void }) {
  const [step, setStep] = React.useState<Step>({ kind: "upload" });
  const [dragging, setDragging] = React.useState(false);
  const [mapping, setMapping] = React.useState<Mapping>({});
  const [entity, setEntity] = React.useState<ImportEntity>(defaultEntity ?? "clients");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const clients = useCrm((s) => s.clients);
  const members = useCrm((s) => s.members);
  const currentUserId = useCrm((s) => s.currentUserId);
  const importRecords = useCrm((s) => s.importRecords);
  const undoImport = useCrm((s) => s.undoImport);

  const load = async (file: File) => {
    setStep({ kind: "loading", fileName: file.name });
    try {
      const table = await parseFile(file);
      if (!table.rows.length) throw new Error("В файле нет строк с данными");
      const auto = autoMap(table.headers);
      setMapping(auto);
      // файл со сделками узнаём по колонкам; в остальном — то, откуда открыли импорт
      const guess = guessEntity(auto);
      setEntity(guess === "deals" ? guess : (defaultEntity ?? guess));
      setStep({ kind: "map", fileName: file.name, table });
    } catch (error) {
      setStep({ kind: "upload" });
      toast.error("Не получилось прочитать файл", { description: error instanceof Error ? error.message : "Сохраните таблицу в CSV или XLSX и попробуйте ещё раз" });
    }
  };

  const prepared = React.useMemo(
    () => (step.kind === "map" ? prepareImport({ table: step.table, mapping, entity, clients, members, fallbackOwner: currentUserId }) : null),
    [step, mapping, entity, clients, members, currentUserId],
  );

  const run = () => {
    if (step.kind !== "map" || !prepared?.rows.length) return;
    const batch = importRecords(step.fileName, prepared.rows);
    const parts = [
      prepared.created.clients && formatCount(prepared.created.clients, ["клиент", "клиента", "клиентов"]),
      prepared.created.deals && formatCount(prepared.created.deals, ["сделка", "сделки", "сделок"]),
      prepared.created.leads && formatCount(prepared.created.leads, ["лид", "лида", "лидов"]),
    ].filter(Boolean);
    setStep({ kind: "done", fileName: step.fileName, batchId: batch.id, summary: parts.join(", ") });
    toast.success("Импорт завершён", { description: parts.join(", ") });
  };

  if (step.kind === "upload" || step.kind === "loading") {
    return (
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void load(file);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
            dragging ? "border-primary bg-primary-soft/50" : "border-border hover:border-input hover:bg-accent/40",
          )}
        >
          {step.kind === "loading" ? <Loader2 className="size-7 animate-spin text-primary" /> : <Upload className="size-7 text-muted-foreground" />}
          <span className="mt-3 text-[15px] font-semibold">{step.kind === "loading" ? `Читаем «${step.fileName}»…` : "Перетащите файл сюда или выберите на компьютере"}</span>
          <span className="mt-1 text-[13px] text-muted-foreground">Excel (XLSX), CSV или выгрузка из amoCRM и Битрикс24 — до 5 000 строк</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void load(file);
            e.target.value = "";
          }}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Нет готового файла?{" "}
          <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${SAMPLE_CSV}`)}`} download="nexora-пример-импорта.csv" className="font-medium text-primary hover:underline">
            Скачайте пример
          </a>{" "}
          и заполните его.
        </p>
      </div>
    );
  }

  if (step.kind === "done") {
    return (
      <div className="flex flex-col items-center px-4 py-8 text-center">
        <CircleCheck className="size-10 animate-pop text-success-text" />
        <p className="mt-3 text-[16px] font-semibold">Готово: {step.summary}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Автоматизации не запускались — старые записи не создадут лишних задач.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild size="sm" onClick={onDone}>
            <Link href={entity === "leads" ? "/leads" : entity === "deals" ? "/deals" : "/clients"}>Открыть {entity === "leads" ? "лиды" : entity === "deals" ? "сделки" : "клиентов"}</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              undoImport(step.batchId);
              toast("Импорт отменён");
              setStep({ kind: "upload" });
            }}
          >
            <RotateCcw />
            Отменить импорт
          </Button>
        </div>
      </div>
    );
  }

  const source = detectSource(step.table.headers);
  const targets = TARGETS.filter((t) => t.entities.includes(entity));
  const sample = step.table.rows.slice(0, 3);
  const nothing = !prepared?.rows.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 px-3.5 py-3">
        <FileSpreadsheet className="size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium">{step.fileName}</p>
          <p className="text-xs text-muted-foreground">
            {formatCount(step.table.rows.length, ["строка", "строки", "строк"])}
            {source ? `, похоже на выгрузку из ${source}` : ""}
          </p>
        </div>
        <Button variant="ghost" size="xs" onClick={() => setStep({ kind: "upload" })}>
          Другой файл
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-medium">Что загружаем</span>
        <Segmented
          size="sm"
          value={entity}
          onValueChange={setEntity}
          options={[
            { value: "clients", label: "Клиентов" },
            { value: "deals", label: "Сделки с клиентами" },
            { value: "leads", label: "Лидов" },
          ]}
          aria-label="Что загружаем"
        />
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3.5 py-2 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          Колонки сопоставлены автоматически — поправьте, если нужно
        </div>
        <ul className="divide-y">
          {targets.map((t) => {
            const column = mapping[t.field];
            return (
              <li key={t.field} className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-3 px-3.5 py-1.5 sm:grid-cols-[160px_220px_minmax(0,1fr)]">
                <span className="text-[13px]">{t.label}</span>
                <Select value={column === undefined ? NONE : String(column)} onValueChange={(v) => setMapping((m) => ({ ...m, [t.field]: v === NONE ? undefined : Number(v) }) as Mapping)}>
                  <SelectTrigger size="sm" className={cn(column === undefined && "text-muted-foreground")} aria-label={`Колонка для поля «${t.label}»`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Не загружать</SelectItem>
                    {step.table.headers.map((h, i) => (
                      <SelectItem key={`${h}-${i}`} value={String(i)}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="hidden truncate text-xs text-muted-foreground sm:block">
                  {column === undefined
                    ? ""
                    : sample
                        .map((r) => r[column])
                        .filter(Boolean)
                        .join(", ")}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-primary-soft/50 px-4 py-3">
        <p className="min-w-0 flex-1 text-[13px]">
          {nothing ? (
            "Не нашли имя, телефон или email — укажите хотя бы одну из этих колонок."
          ) : (
            <>
              Будет создано:{" "}
              <span className="font-semibold">
                {[
                  prepared!.created.clients && formatCount(prepared!.created.clients, ["клиент", "клиента", "клиентов"]),
                  prepared!.created.deals && formatCount(prepared!.created.deals, ["сделка", "сделки", "сделок"]),
                  prepared!.created.leads && formatCount(prepared!.created.leads, ["лид", "лида", "лидов"]),
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
              {prepared!.duplicates > 0 && (
                <span className="text-muted-foreground">
                  . {entity === "deals" ? "Уже есть в CRM" : "Пропустим дубли"}: {formatCount(prepared!.duplicates, ["клиент", "клиента", "клиентов"])}
                </span>
              )}
            </>
          )}
        </p>
        <Button size="sm" onClick={run} disabled={nothing}>
          Импортировать
        </Button>
      </div>
      {!inline && <p className="text-xs text-muted-foreground">Импорт можно отменить одним нажатием сразу после загрузки или в «Настройки → Импорт данных».</p>}
    </div>
  );
}

export function ImportDialog({ open, onOpenChange, entity }: { open: boolean; onOpenChange: (open: boolean) => void; entity?: ImportEntity }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Импорт из файла</DialogTitle>
          <DialogDescription>Excel или CSV — из таблицы, amoCRM или Битрикс24. Ничего настраивать заранее не нужно.</DialogDescription>
        </DialogHeader>
        {open && <ImportWizard defaultEntity={entity} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}


