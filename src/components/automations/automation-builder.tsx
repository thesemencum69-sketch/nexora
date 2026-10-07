"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FlaskConical, Plus, Trash2, Workflow, X } from "lucide-react";
import { toast } from "sonner";
import type {
  ActionType,
  Automation,
  AutomationAction,
  AutomationCondition,
  ConditionField,
  ConditionOperator,
  DealStageId,
  LeadSource,
  LeadStatus,
  Priority,
  TriggerType,
} from "@/types/crm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MemberSelect, SourceSelect, StageSelect } from "@/components/forms/form-controls";
import { PriorityIcon } from "@/components/common/entity-meta";
import { PageSkeleton } from "@/components/common/skeletons";
import { EmptyState } from "@/components/common/states";
import { useCrm, useMemberMap, useNow, useReady } from "@/hooks/use-crm";
import { conditionMatches } from "@/lib/automation-engine";
import { AUTOMATION_TEMPLATES } from "@/lib/demo/automations";
import { LEAD_STATUSES, OPEN_STAGES, PRIORITIES } from "@/lib/constants";
import { stageLabel } from "@/lib/stages";
import { DAY } from "@/lib/time";
import { cn, plural, uid } from "@/lib/utils";
import {
  ACTIONS,
  DUE_OPTIONS,
  FIELDS,
  OPERATORS,
  RECIPIENTS,
  TRIGGERS,
  defaultParams,
  operatorsFor,
  sentence,
} from "./automation-meta";

type Draft = Pick<Automation, "name" | "description" | "trigger" | "conditions" | "actions" | "active">;

const BLANK: Draft = {
  name: "",
  description: "",
  active: true,
  trigger: { type: "lead_created" },
  conditions: [],
  actions: [{ id: "a1", type: "assign_owner", params: defaultParams("assign_owner") }],
};

function Block({ step, title, hint, tone, children }: { step: string; title: string; hint?: string; tone: "when" | "if" | "then"; children: React.ReactNode }) {
  return (
    <section className="relative rounded-xl border bg-card p-4 shadow-card sm:p-5">
      <header className="mb-4 flex items-center gap-2.5">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-semibold",
            tone === "when" && "bg-primary-soft text-primary",
            tone === "if" && "bg-warning/15 text-warning-text",
            tone === "then" && "bg-success/12 text-success-text",
          )}
        >
          {step}
        </span>
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {hint && <span className="ml-auto text-xs text-muted-foreground">{hint}</span>}
      </header>
      {children}
    </section>
  );
}

function Connector() {
  return (
    <div aria-hidden className="flex justify-center">
      <span className="h-6 w-px bg-border" />
    </div>
  );
}

function ConditionRow({
  condition,
  subject,
  onChange,
  onRemove,
}: {
  condition: AutomationCondition;
  subject: "deal" | "lead" | "task";
  onChange: (c: AutomationCondition) => void;
  onRemove: () => void;
}) {
  const fields = FIELDS.filter((f) => subject !== "task" && f.subjects.includes(subject));
  const setField = (field: ConditionField) => {
    const operator = operatorsFor(field)[0]!;
    const value = field === "amount" ? "100000" : field === "source" ? "instagram" : field === "priority" ? "high" : field === "stage" ? "proposal" : "";
    onChange({ ...condition, field, operator, value });
  };
  return (
    <div className="grid gap-2 rounded-lg bg-muted/50 p-2.5 sm:grid-cols-[minmax(0,1fr)_120px_minmax(0,1.3fr)_auto] sm:items-center">
      <Select value={condition.field} onValueChange={(v: ConditionField) => setField(v)}>
        <SelectTrigger size="sm" aria-label="Поле">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fields.map((f) => (
            <SelectItem key={f.field} value={f.field}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={condition.operator} onValueChange={(v: ConditionOperator) => onChange({ ...condition, operator: v })}>
        <SelectTrigger size="sm" aria-label="Условие">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operatorsFor(condition.field).map((op) => (
            <SelectItem key={op} value={op}>
              {OPERATORS[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="min-w-0">
        {condition.field === "amount" && (
          <div className="relative">
            <Input
              inputMode="numeric"
              className="h-8 pr-7 text-[13px]"
              value={condition.value}
              onChange={(e) => onChange({ ...condition, value: e.target.value.replace(/\D/g, "") })}
              aria-label="Сумма"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₽</span>
          </div>
        )}
        {condition.field === "source" && <SourceSelect value={condition.value as LeadSource} onChange={(v) => onChange({ ...condition, value: v })} />}
        {condition.field === "stage" && <StageSelect value={condition.value as DealStageId} onChange={(v) => onChange({ ...condition, value: v })} />}
        {condition.field === "owner" && <MemberSelect value={condition.value} onChange={(v) => onChange({ ...condition, value: v })} />}
        {condition.field === "priority" && (
          <Select value={condition.value} onValueChange={(v) => onChange({ ...condition, value: v })}>
            <SelectTrigger size="sm" aria-label="Приоритет">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["high", "medium", "low"] as const).map((p) => (
                <SelectItem key={p} value={p}>
                  <PriorityIcon priority={p} />
                  {PRIORITIES[p].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Удалить условие" className="justify-self-end text-muted-foreground">
        <X />
      </Button>
    </div>
  );
}

function ActionEditor({
  action,
  subject,
  onChange,
  onRemove,
  canRemove,
}: {
  action: AutomationAction;
  subject: "deal" | "lead" | "task";
  onChange: (a: AutomationAction) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const members = useCrm((s) => s.members);
  const meta = ACTIONS.find((a) => a.type === action.type);
  const set = (key: string, value: string) => onChange({ ...action, params: { ...action.params, [key]: value } });
  const who = (value: string | undefined, key: string, withTeam = false) => (
    <Select value={value ?? "owner"} onValueChange={(v) => set(key, v)}>
      <SelectTrigger size="sm" aria-label="Кому">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RECIPIENTS.filter((r) => withTeam || r.value !== "team").map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label.charAt(0).toUpperCase() + r.label.slice(1)}
          </SelectItem>
        ))}
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-2.5 rounded-lg border bg-background/60 p-3">
      <div className="flex items-center gap-2">
        <Select
          value={action.type}
          onValueChange={(type: ActionType) => onChange({ ...action, type, params: defaultParams(type) })}
        >
          <SelectTrigger size="sm" className="max-w-[260px]" aria-label="Действие">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIONS.filter((a) => a.subjects.includes(subject)).map((a) => (
              <SelectItem key={a.type} value={a.type}>
                {a.label}
                {a.soon && <span className="text-xs text-muted-foreground">скоро</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {meta?.soon && <Badge variant="muted" size="sm">Появится с интеграциями</Badge>}
        {canRemove && (
          <Button variant="ghost" size="icon-sm" className="ml-auto text-muted-foreground" onClick={onRemove} aria-label="Удалить действие">
            <Trash2 />
          </Button>
        )}
      </div>

      {action.type === "create_task" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input className="h-8 text-[13px] sm:col-span-2" value={action.params.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="Название задачи" aria-label="Название задачи" />
          {who(action.params.assignee, "assignee")}
          <Select value={action.params.dueInHours ?? "24"} onValueChange={(v) => set("dueInHours", v)}>
            <SelectTrigger size="sm" aria-label="Срок">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DUE_OPTIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  Срок {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {action.type === "notify" && (
        <div className="grid gap-2 sm:grid-cols-[200px_minmax(0,1fr)]">
          {who(action.params.to, "to", true)}
          <Input className="h-8 text-[13px]" value={action.params.message ?? ""} onChange={(e) => set("message", e.target.value)} placeholder="Текст уведомления" aria-label="Текст уведомления" />
        </div>
      )}
      {action.type === "assign_owner" && (
        <Select value={action.params.strategy ?? "round_robin"} onValueChange={(v) => set("strategy", v)}>
          <SelectTrigger size="sm" className="w-full max-w-[380px]" aria-label="Кого назначить">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="round_robin">По очереди: у кого меньше открытых лидов</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {action.type === "set_priority" && (
        <Select value={action.params.priority ?? "high"} onValueChange={(v) => set("priority", v as Priority)}>
          <SelectTrigger size="sm" className="max-w-[220px]" aria-label="Приоритет">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["high", "medium", "low"] as const).map((p) => (
              <SelectItem key={p} value={p}>
                <PriorityIcon priority={p} />
                {PRIORITIES[p].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {action.type === "set_lead_status" && (
        <Select value={action.params.status ?? "contacted"} onValueChange={(v) => set("status", v as LeadStatus)}>
          <SelectTrigger size="sm" className="max-w-[220px]" aria-label="Статус">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["contacted", "qualified", "disqualified"] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {LEAD_STATUSES[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {action.type === "send_telegram" && (
        <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)]">
          <Input className="h-8 text-[13px]" value={action.params.chat ?? ""} onChange={(e) => set("chat", e.target.value)} placeholder="@chat" aria-label="Чат" />
          <Input className="h-8 text-[13px]" value={action.params.message ?? ""} onChange={(e) => set("message", e.target.value)} placeholder="Текст сообщения" aria-label="Сообщение" />
        </div>
      )}
      {action.type === "webhook" && (
        <Input className="h-8 text-[13px]" value={action.params.url ?? ""} onChange={(e) => set("url", e.target.value)} placeholder="https://example.com/hook" aria-label="URL вебхука" />
      )}
    </div>
  );
}

export function AutomationBuilder({ id }: { id?: string }) {
  const ready = useReady();
  if (!ready) return <PageSkeleton variant="form" />;
  return <Builder id={id} />;
}

function Builder({ id }: { id?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const existing = useCrm((s) => (id ? s.automations.find((a) => a.id === id) : undefined));
  const save = useCrm((s) => s.saveAutomation);
  const me = useCrm((s) => s.currentUserId);
  const deals = useCrm((s) => s.deals);
  const leads = useCrm((s) => s.leads);
  const members = useMemberMap();
  const now = useNow();

  const [draft, setDraft] = React.useState<Draft>(() => {
    if (existing) return existing;
    const template = AUTOMATION_TEMPLATES[Number(params.get("template"))];
    return template ? { ...template, active: true } : BLANK;
  });
  const [nameError, setNameError] = React.useState("");

  const trigger = TRIGGERS.find((t) => t.type === draft.trigger.type)!;
  const subject = trigger.subject;
  const memberName = (memberId: string) => members.get(memberId)?.name ?? "сотрудник";

  const setTrigger = (type: TriggerType) => {
    const next = TRIGGERS.find((t) => t.type === type)!;
    setDraft((d) => ({
      ...d,
      trigger: { type, ...(type === "deal_stage_changed" ? { stage: "proposal" as DealStageId } : {}), ...(type === "deal_idle" ? { days: 7 } : {}) },
      conditions: next.subject === "task" ? [] : d.conditions.filter((c) => FIELDS.find((f) => f.field === c.field)?.subjects.includes(next.subject as "deal" | "lead")),
      actions: d.actions.filter((a) => ACTIONS.find((x) => x.type === a.type)?.subjects.includes(next.subject)),
    }));
  };

  // Предпросмотр: сколько раз правило сработало бы за последние 30 дней
  const preview = React.useMemo(() => {
    const since = now - 30 * DAY;
    const conditionsOk = (subjectValue: Parameters<typeof conditionMatches>[0]) => draft.conditions.every((c) => conditionMatches(subjectValue, c));
    switch (draft.trigger.type) {
      case "lead_created":
        return leads.filter((l) => Date.parse(l.createdAt) >= since && conditionsOk({ kind: "lead", lead: l })).length;
      case "deal_created":
        return deals.filter((d) => Date.parse(d.createdAt) >= since && conditionsOk({ kind: "deal", deal: d })).length;
      case "deal_won":
        return deals.filter((d) => d.stage === "won" && d.closedAt && Date.parse(d.closedAt) >= since && conditionsOk({ kind: "deal", deal: d })).length;
      case "deal_stage_changed":
        return deals.filter(
          (d) =>
            d.stageHistory.some((h) => h.stage === draft.trigger.stage && Date.parse(h.at) >= since) && conditionsOk({ kind: "deal", deal: d }),
        ).length;
      case "deal_idle":
        return deals.filter((d) => !d.closedAt && now - Date.parse(d.lastActivityAt) > (draft.trigger.days ?? 7) * DAY && conditionsOk({ kind: "deal", deal: d })).length;
      default:
        return null;
    }
  }, [draft.trigger, draft.conditions, deals, leads, now]);

  if (id && !existing) {
    return (
      <div className="rounded-xl border bg-card shadow-card">
        <EmptyState
          icon={Workflow}
          title="Автоматизация не найдена"
          description="Возможно, её удалили."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/automations">К списку</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const submit = () => {
    if (draft.name.trim().length < 3) {
      setNameError("Назовите автоматизацию — так её проще найти");
      return;
    }
    if (!draft.actions.length) {
      toast.error("Добавьте хотя бы одно действие");
      return;
    }
    save({
      id: existing?.id ?? uid("auto"),
      runs: existing?.runs ?? 0,
      lastRunAt: existing?.lastRunAt ?? null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      createdBy: existing?.createdBy ?? me,
      ...draft,
      name: draft.name.trim(),
    });
    toast.success(existing ? "Изменения сохранены" : "Автоматизация создана", { description: draft.name.trim() });
    router.push("/automations");
  };

  return (
    <div className="animate-page space-y-5">
      <Link href="/automations" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        Автоматизации
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-1.5">
          <input
            value={draft.name}
            onChange={(e) => {
              setDraft((d) => ({ ...d, name: e.target.value }));
              setNameError("");
            }}
            placeholder="Название автоматизации"
            aria-label="Название автоматизации"
            aria-invalid={Boolean(nameError)}
            autoFocus={!existing}
            className="w-full rounded-md bg-transparent text-[26px] font-semibold tracking-[-0.025em] outline-none placeholder:text-muted-foreground/50"
          />
          <input
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Коротко: зачем она нужна"
            aria-label="Описание"
            className="w-full bg-transparent text-[15px] text-muted-foreground outline-none placeholder:text-muted-foreground/50"
          />
          {nameError && <p className="text-xs text-critical-text">{nameError}</p>}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[13px]">
            <Switch checked={draft.active} onCheckedChange={(active) => setDraft((d) => ({ ...d, active }))} />
            {draft.active ? "Включена" : "Выключена"}
          </label>
          <Button variant="outline" size="sm" onClick={() => router.push("/automations")}>
            Отмена
          </Button>
          <Button size="sm" onClick={submit}>
            {existing ? "Сохранить" : "Создать"}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="mx-auto w-full max-w-3xl xl:mx-0">
          <Block step="Когда" title="Событие-триггер" tone="when" hint={trigger.scheduled ? "проверяется каждый час" : "срабатывает сразу"}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Select value={draft.trigger.type} onValueChange={(v: TriggerType) => setTrigger(v)}>
                <SelectTrigger aria-label="Триггер">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((t) => (
                    <SelectItem key={t.type} value={t.type}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {draft.trigger.type === "deal_stage_changed" && (
                <Select value={draft.trigger.stage ?? "proposal"} onValueChange={(stage: DealStageId) => setDraft((d) => ({ ...d, trigger: { ...d.trigger, stage } }))}>
                  <SelectTrigger aria-label="Этап">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...OPEN_STAGES, "won" as const, "lost" as const].map((s) => (
                      <SelectItem key={s} value={s}>
                        {stageLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {draft.trigger.type === "deal_idle" && (
                <Select value={String(draft.trigger.days ?? 7)} onValueChange={(v) => setDraft((d) => ({ ...d, trigger: { ...d.trigger, days: Number(v) } }))}>
                  <SelectTrigger aria-label="Сколько дней">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[3, 5, 7, 14, 30].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {plural(n, ["день", "дня", "дней"])} без активности
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </Block>
          <Connector />
          <Block step="Если" title="Условия" tone="if" hint={draft.conditions.length > 1 ? "должны выполняться все" : undefined}>
            {subject === "task" ? (
              <p className="text-[13px] text-muted-foreground">Для задач условия появятся в следующей версии — правило сработает для любой просроченной задачи.</p>
            ) : (
              <div className="space-y-2">
                {draft.conditions.length === 0 && <p className="text-[13px] text-muted-foreground">Без условий — правило сработает для каждого события.</p>}
                {draft.conditions.map((c, index) => (
                  <ConditionRow
                    key={c.id}
                    condition={c}
                    subject={subject}
                    onChange={(next) => setDraft((d) => ({ ...d, conditions: d.conditions.map((x, i) => (i === index ? next : x)) }))}
                    onRemove={() => setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, i) => i !== index) }))}
                  />
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      conditions: [...d.conditions, { id: uid("c"), field: "amount", operator: "gt", value: "100000" }],
                    }))
                  }
                >
                  <Plus />
                  Добавить условие
                </Button>
              </div>
            )}
          </Block>
          <Connector />
          <Block step="То" title="Действия" tone="then" hint="выполняются по порядку">
            <div className="space-y-2">
              {draft.actions.map((a, index) => (
                <ActionEditor
                  key={a.id}
                  action={a}
                  subject={subject}
                  canRemove={draft.actions.length > 1}
                  onChange={(next) => setDraft((d) => ({ ...d, actions: d.actions.map((x, i) => (i === index ? next : x)) }))}
                  onRemove={() => setDraft((d) => ({ ...d, actions: d.actions.filter((_, i) => i !== index) }))}
                />
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDraft((d) => ({ ...d, actions: [...d.actions, { id: uid("a"), type: "notify", params: defaultParams("notify") }] }))}
              >
                <Plus />
                Добавить действие
              </Button>
            </div>
          </Block>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-xl border bg-card p-5 shadow-card">
            <h2 className="text-[13px] font-semibold">Как это будет работать</h2>
            <p className="mt-2 text-[14px] leading-relaxed">{sentence(draft, memberName)}</p>
          </section>
          <section className="rounded-xl border bg-card p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold">
              <FlaskConical className="size-4 text-primary" />
              Проверка на ваших данных
            </h2>
            {preview === null ? (
              <p className="mt-2 text-[13px] text-muted-foreground">Для этого события предпросмотр пока недоступен.</p>
            ) : (
              <>
                <p className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">{preview}</p>
                <p className="text-[13px] text-muted-foreground">
                  {plural(preview, ["раз сработала бы", "раза сработала бы", "раз сработала бы"])} за последние 30 дней
                </p>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
