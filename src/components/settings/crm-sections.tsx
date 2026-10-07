"use client";

import * as React from "react";
import { Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CustomField, CustomFieldEntity, Requisites, StageSetting, VatMode } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddFieldButton, FIELD_TYPES } from "@/components/fields/custom-fields";
import { ImportWizard } from "@/components/import/import-wizard";
import { INDUSTRY_PACKS, packFor } from "@/config/industries";
import { useCrm } from "@/hooks/use-crm";
import { STAGES } from "@/lib/constants";
import { formatCount, formatDateLong, formatMoney } from "@/lib/format";
import { TEMPLATE_VARIABLES } from "@/lib/inbox";
import { cn } from "@/lib/utils";
import { SettingsCard } from "./settings-nav";

/* ───────────── Реквизиты ───────────── */

const VAT_OPTIONS: { value: VatMode; label: string }[] = [
  { value: "none", label: "Без НДС (УСН)" },
  { value: "vat5", label: "НДС 5%" },
  { value: "vat7", label: "НДС 7%" },
  { value: "vat20", label: "НДС 20%" },
];

export function RequisitesCard() {
  const requisites = useCrm((s) => s.workspace.requisites);
  const updateRequisites = useCrm((s) => s.updateRequisites);
  const [form, setForm] = React.useState<Requisites>(requisites);
  React.useEffect(() => setForm(requisites), [requisites]);
  const set = (key: keyof Requisites) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const fields: [keyof Requisites, string, string][] = [
    ["legalName", "Полное название", "ООО «Ромашка»"],
    ["inn", "ИНН", "10 или 12 цифр"],
    ["kpp", "КПП", "9 цифр"],
    ["director", "Руководитель", "Фамилия И. О."],
    ["bank", "Банк", "Название банка"],
    ["bik", "БИК", "9 цифр"],
    ["account", "Расчётный счёт", "20 цифр"],
    ["corrAccount", "Корр. счёт", "20 цифр"],
  ];

  return (
    <SettingsCard
      title="Реквизиты для счетов"
      description="Подставляются в счета и КП, по ним строится QR-код для оплаты"
      footer={
        <Button
          size="sm"
          onClick={() => {
            if (form.inn && !/^\d{10}(\d{2})?$/.test(form.inn)) return toast.error("Проверьте ИНН: нужно 10 или 12 цифр");
            if (form.account && !/^\d{20}$/.test(form.account)) return toast.error("Проверьте расчётный счёт: нужно 20 цифр");
            updateRequisites(form);
            toast.success("Реквизиты сохранены", { description: "Новые счета будут выставляться с ними" });
          }}
        >
          Сохранить
        </Button>
      }
    >
      {requisites.sample && (
        <p className="mb-4 rounded-lg bg-warning/10 px-3 py-2 text-[13px] text-warning-text">Сейчас здесь демо-реквизиты. Замените их своими перед отправкой счетов клиентам.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([key, label, placeholder]) => (
          <Field key={key} label={label} htmlFor={`req-${key}`}>
            <Input id={`req-${key}`} value={String(form[key] ?? "")} onChange={set(key)} placeholder={placeholder} className={cn(["inn", "kpp", "bik", "account", "corrAccount"].includes(key) && "tabular")} />
          </Field>
        ))}
        <Field label="Юридический адрес" htmlFor="req-address" className="sm:col-span-2">
          <Input id="req-address" value={form.address} onChange={set("address")} placeholder="Индекс, город, улица, дом" />
        </Field>
        <Field label="Налог" htmlFor="req-vat">
          <Select value={form.vat} onValueChange={(vat: VatMode) => setForm((f) => ({ ...f, vat }))}>
            <SelectTrigger id="req-vat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VAT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </SettingsCard>
  );
}

/* ───────────── Воронка ───────────── */

export function PipelineSection() {
  const workspace = useCrm((s) => s.workspace);
  const updatePipeline = useCrm((s) => s.updatePipeline);
  const applyIndustryTemplate = useCrm((s) => s.applyIndustryTemplate);
  const current = packFor(workspace.industry);
  const [chosen, setChosen] = React.useState(current.label);
  const [include, setInclude] = React.useState({ fields: true, products: true, templates: true });
  const pack = packFor(chosen);
  const pipeline = workspace.pipeline;

  const patchStage = (id: StageSetting["id"], change: Partial<StageSetting>) => updatePipeline(pipeline.map((s) => (s.id === id ? { ...s, ...change } : s)));

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Шаблон под сферу"
        description="Этапы, поля, товары и ответы, с которыми удобно начать. Сделки и клиенты не изменятся"
        footer={
          <Button
            size="sm"
            disabled={chosen === current.label && pipeline.every((s) => STAGES.find((x) => x.id === s.id)!.closed || s.label === current.stages[s.id as keyof typeof current.stages])}
            onClick={() => {
              applyIndustryTemplate(chosen, include);
              toast.success(`Шаблон «${pack.short}» применён`, { description: "Названия этапов обновились во всех разделах" });
            }}
          >
            Применить шаблон
          </Button>
        }
      >
        <div role="radiogroup" aria-label="Сфера" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {INDUSTRY_PACKS.map((p) => {
            const selected = p.label === chosen;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setChosen(p.label)}
                className={cn(
                  "relative rounded-xl border bg-card px-3.5 py-3 text-left outline-none transition-[border-color,box-shadow,background-color] focus-visible:ring-2 focus-visible:ring-ring/40",
                  selected ? "border-primary bg-primary-soft/40 ring-1 ring-primary/25" : "hover:border-input",
                )}
              >
                <span className="block text-[13.5px] font-semibold">{p.short}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{p.example}</span>
                {p.label === current.label && <span className="mt-2 inline-block text-[11px] font-medium text-primary">Сейчас</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-4 rounded-xl border bg-muted/30 p-3.5">
          <p className="text-xs font-medium text-muted-foreground">Этапы</p>
          <ol className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
            {STAGES.filter((s) => !s.closed).map((s, i) => (
              <li key={s.id} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden className="h-px w-3 bg-border" />}
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1">
                  <span className="size-1.5 rounded-full" style={{ background: s.color }} />
                  {pack.stages[s.id as keyof typeof pack.stages]}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-3.5 flex flex-wrap gap-x-5 gap-y-2">
            {(
              [
                ["fields", `Поля: ${pack.fields.map((f) => f.label.toLowerCase()).join(", ")}`],
                ["products", `Товары и услуги: ${pack.products.length}`],
                ["templates", `Шаблоны ответов: ${pack.replyTemplates.length}`],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex max-w-full items-center gap-2 text-[13px]">
                <Checkbox checked={include[key]} onCheckedChange={(v) => setInclude((i) => ({ ...i, [key]: v === true }))} />
                <span className="truncate">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Этапы сделок"
        description="Названия меняются сразу во всех разделах. Вероятность нужна для прогноза выручки"
        footer={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              updatePipeline(pipeline.map((s) => ({ ...s, label: STAGES.find((x) => x.id === s.id)!.label, probability: STAGES.find((x) => x.id === s.id)!.probability })));
              toast("Вернули стандартные этапы");
            }}
          >
            <RotateCcw />
            Стандартные названия
          </Button>
        }
      >
        <ol className="divide-y rounded-lg border">
          {STAGES.map((stage, i) => {
            const setting = pipeline.find((p) => p.id === stage.id) ?? { id: stage.id, label: stage.label, probability: stage.probability };
            return (
              <li key={stage.id} className="flex items-center gap-3 px-3 py-1.5">
                <span className="tabular w-4 text-xs text-muted-foreground">{i + 1}</span>
                <span className="size-2 shrink-0 rounded-full" style={{ background: stage.color }} />
                <Input
                  key={setting.label}
                  defaultValue={setting.label}
                  aria-label={`Название этапа ${i + 1}`}
                  onBlur={(e) => {
                    const label = e.target.value.trim();
                    if (label && label !== setting.label) patchStage(stage.id, { label });
                    else e.target.value = setting.label;
                  }}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className="h-8 flex-1 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input focus-visible:bg-card"
                />
                {stage.closed ? (
                  <span className="tabular w-20 pr-2 text-right text-xs text-muted-foreground">{Math.round(stage.probability * 100)}%</span>
                ) : (
                  <span className="flex w-20 items-center justify-end gap-1">
                    <Input
                      key={setting.probability}
                      defaultValue={Math.round(setting.probability * 100)}
                      inputMode="numeric"
                      aria-label={`Вероятность закрытия на этапе ${setting.label}`}
                      onBlur={(e) => {
                        const value = Math.min(99, Math.max(1, Number(e.target.value) || 0));
                        if (value / 100 !== setting.probability) patchStage(stage.id, { probability: value / 100 });
                        e.target.value = String(value);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      className="tabular h-8 w-14 px-2 text-right"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </SettingsCard>
    </div>
  );
}

/* ───────────── Свои поля ───────────── */

function FieldRow({ field, filled }: { field: CustomField; filled: number }) {
  const updateCustomField = useCrm((s) => s.updateCustomField);
  const deleteCustomField = useCrm((s) => s.deleteCustomField);
  const [confirm, setConfirm] = React.useState(false);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
      <Input
        key={field.label}
        defaultValue={field.label}
        aria-label="Название поля"
        onBlur={(e) => {
          const label = e.target.value.trim();
          if (label.length >= 2 && label !== field.label) updateCustomField(field.id, { label });
          else e.target.value = field.label;
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-8 min-w-40 flex-1 border-transparent bg-transparent px-2 font-medium shadow-none hover:border-input focus-visible:border-input focus-visible:bg-card"
      />
      <Badge variant="muted" size="sm">
        {FIELD_TYPES.find((t) => t.value === field.type)?.label}
      </Badge>
      {field.type === "select" && (
        <Input
          key={(field.options ?? []).join(",")}
          defaultValue={(field.options ?? []).join(", ")}
          aria-label="Варианты через запятую"
          onBlur={(e) => {
            const options = [...new Set(e.target.value.split(",").map((o) => o.trim()).filter(Boolean))];
            if (options.length && options.join(",") !== (field.options ?? []).join(",")) updateCustomField(field.id, { options });
          }}
          className="h-8 w-full text-[13px] sm:w-64"
        />
      )}
      <span className="tabular ml-auto text-xs text-muted-foreground">заполнено: {filled}</span>
      <Button variant="ghost" size="icon-xs" onClick={() => setConfirm(true)} aria-label={`Удалить поле «${field.label}»`}>
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Удалить поле «${field.label}»?`}
        description={filled ? `Значения будут удалены у ${filled} записей.` : "Поле пока нигде не заполнено."}
        confirmLabel="Удалить"
        onConfirm={() => {
          deleteCustomField(field.id);
          toast("Поле удалено", { description: field.label });
        }}
      />
    </li>
  );
}

export function FieldsSection() {
  const fields = useCrm((s) => s.customFields);
  const deals = useCrm((s) => s.deals);
  const clients = useCrm((s) => s.clients);
  const filled = (field: CustomField) => (field.entity === "deal" ? deals : clients).filter((x) => x.custom?.[field.id]).length;
  const groups: { entity: CustomFieldEntity; title: string; description: string }[] = [
    { entity: "deal", title: "Поля сделок", description: "Показываются в карточке сделки под основными свойствами" },
    { entity: "client", title: "Поля клиентов", description: "Показываются в профиле клиента" },
  ];
  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const list = fields.filter((f) => f.entity === g.entity);
        return (
          <SettingsCard key={g.entity} title={g.title} description={g.description}>
            {list.length ? (
              <ul className="divide-y rounded-lg border">
                {list.map((f) => (
                  <FieldRow key={f.id} field={f} filled={filled(f)} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Своих полей пока нет.</p>
            )}
            <AddFieldButton entity={g.entity} className="mt-3" />
          </SettingsCard>
        );
      })}
      <p className="px-1 text-xs text-muted-foreground">Поле можно добавить и прямо из карточки — кнопкой «Добавить поле».</p>
    </div>
  );
}

/* ───────────── Товары и услуги ───────────── */

export function ProductsSection() {
  const products = useCrm((s) => s.products);
  const addProduct = useCrm((s) => s.addProduct);
  const updateProduct = useCrm((s) => s.updateProduct);
  const deleteProduct = useCrm((s) => s.deleteProduct);
  const [draft, setDraft] = React.useState({ name: "", price: "", unit: "шт." });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(draft.price.replace(/\s/g, "").replace(",", "."));
    if (draft.name.trim().length < 2 || !Number.isFinite(price)) return;
    addProduct({ name: draft.name.trim(), price, unit: draft.unit.trim() || "шт." });
    setDraft({ name: "", price: "", unit: draft.unit });
    toast.success("Добавлено в каталог", { description: draft.name.trim() });
  };

  return (
    <SettingsCard title="Каталог" description="Добавляйте позиции в сделку из каталога — сумма сделки, счёт и КП посчитаются сами">
      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[minmax(0,1fr)_120px_80px_32px] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Название</span>
          <span className="text-right">Цена, ₽</span>
          <span>Ед.</span>
          <span />
        </div>
        <ul className="divide-y">
          {products.map((p) => (
            <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_120px_80px_32px] items-center gap-2 px-3 py-1">
              {(["name", "price", "unit"] as const).map((key) => (
                <Input
                  key={`${key}-${p[key]}`}
                  defaultValue={key === "price" ? String(p.price) : p[key]}
                  inputMode={key === "price" ? "decimal" : undefined}
                  aria-label={key === "name" ? "Название" : key === "price" ? "Цена" : "Единица"}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    if (key === "price") {
                      const price = Number(raw.replace(/\s/g, "").replace(",", "."));
                      if (Number.isFinite(price) && price >= 0 && price !== p.price) updateProduct(p.id, { price });
                    } else if (raw && raw !== p[key]) updateProduct(p.id, { [key]: raw });
                  }}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className={cn("h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input focus-visible:bg-card", key === "price" && "tabular text-right")}
                />
              ))}
              <Button variant="ghost" size="icon-xs" onClick={() => deleteProduct(p.id)} aria-label={`Удалить «${p.name}»`}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="grid grid-cols-[minmax(0,1fr)_120px_80px_32px] items-center gap-2 border-t bg-muted/20 px-3 py-2">
          <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Новая позиция" className="h-8" aria-label="Название новой позиции" />
          <Input value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} placeholder="0" inputMode="decimal" className="tabular h-8 text-right" aria-label="Цена новой позиции" />
          <Input value={draft.unit} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} className="h-8" aria-label="Единица" />
          <Button type="submit" size="icon-xs" disabled={draft.name.trim().length < 2 || !draft.price} aria-label="Добавить позицию">
            <Plus />
          </Button>
        </form>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {formatCount(products.length, ["позиция", "позиции", "позиций"])}
        {products.length ? `, от ${formatMoney(Math.min(...products.map((p) => p.price)))} до ${formatMoney(Math.max(...products.map((p) => p.price)))}` : ""}
      </p>
    </SettingsCard>
  );
}

/* ───────────── Шаблоны ответов ───────────── */

export function TemplatesSection() {
  const templates = useCrm((s) => s.replyTemplates);
  const addTemplate = useCrm((s) => s.addTemplate);
  const updateTemplate = useCrm((s) => s.updateTemplate);
  const deleteTemplate = useCrm((s) => s.deleteTemplate);
  const refs = React.useRef(new Map<string, HTMLTextAreaElement>());

  const insertVariable = (id: string, token: string) => {
    const el = refs.current.get(id);
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const next = `${el.value.slice(0, start)}${token}${el.value.slice(el.selectionEnd ?? start)}`;
    updateTemplate(id, { body: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <SettingsCard
      title="Быстрые ответы"
      description="Во «Входящих» наберите «/» или нажмите «Шаблоны». Переменные подставятся сами"
      footer={
        <Button size="sm" variant="outline" onClick={() => addTemplate({ title: "Новый шаблон", body: "Здравствуйте, {имя}! " })}>
          <Plus />
          Новый шаблон
        </Button>
      }
    >
      <ul className="space-y-3">
        {templates.map((t) => (
          <li key={t.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2">
              <Input
                key={t.title}
                defaultValue={t.title}
                aria-label="Название шаблона"
                onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== t.title && updateTemplate(t.id, { title: e.target.value.trim() })}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="h-8 flex-1 border-transparent bg-transparent px-2 font-semibold shadow-none hover:border-input focus-visible:border-input focus-visible:bg-card"
              />
              <Button variant="ghost" size="icon-xs" onClick={() => deleteTemplate(t.id)} aria-label={`Удалить шаблон «${t.title}»`}>
                <Trash2 />
              </Button>
            </div>
            <Textarea
              ref={(el) => {
                if (el) refs.current.set(t.id, el);
              }}
              value={t.body}
              onChange={(e) => updateTemplate(t.id, { body: e.target.value })}
              rows={3}
              aria-label="Текст шаблона"
              className="mt-2"
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Вставить:</span>
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => insertVariable(t.id, v.token)}
                  className="rounded-md border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:bg-accent"
                  title={v.label}
                >
                  {v.token}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}

/* ───────────── Импорт ───────────── */

export function ImportSection() {
  const imports = useCrm((s) => s.imports);
  const undoImport = useCrm((s) => s.undoImport);
  return (
    <div className="space-y-5">
      <SettingsCard title="Импорт данных" description="Excel или CSV — из таблицы, amoCRM, Битрикс24 или другой CRM. Колонки распознаются автоматически">
        <ImportWizard inline />
      </SettingsCard>
      {imports.length > 0 && (
        <SettingsCard title="История импорта" description="Последний импорт можно отменить, если что-то пошло не так">
          <ul className="divide-y rounded-lg border">
            {imports.map((b, i) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]">
                <Check className="size-4 text-success-text" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{b.fileName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDateLong(b.at)}: {[b.clientIds.length && formatCount(b.clientIds.length, ["клиент", "клиента", "клиентов"]), b.dealIds.length && formatCount(b.dealIds.length, ["сделка", "сделки", "сделок"]), b.leadIds.length && formatCount(b.leadIds.length, ["лид", "лида", "лидов"])].filter(Boolean).join(", ")}
                  </span>
                </span>
                {i === 0 && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      undoImport(b.id);
                      toast("Импорт отменён", { description: b.fileName });
                    }}
                  >
                    <RotateCcw />
                    Отменить
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </SettingsCard>
      )}
    </div>
  );
}
