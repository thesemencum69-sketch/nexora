"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, MoreHorizontal, Pencil, Plus, Sparkles, Trash2, Workflow, Zap } from "lucide-react";
import { toast } from "sonner";
import type { Automation } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/misc";
import { PageHeader } from "@/components/common/page-header";
import { PageSkeleton } from "@/components/common/skeletons";
import { EmptyState } from "@/components/common/states";
import { StatTile } from "@/components/common/stat-tile";
import { useCrm, useMemberMap, useNow, useReady } from "@/hooks/use-crm";
import { describeTrigger } from "@/lib/automation-engine";
import { AUTOMATION_TEMPLATES } from "@/lib/demo/automations";
import { formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TRIGGERS, describeAction, describeCondition } from "./automation-meta";

function FlowChip({ tone, label, children }: { tone: "when" | "if" | "then"; label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-card px-2 py-1 text-xs">
      <span
        className={cn(
          "rounded px-1.5 py-px text-[11px] font-medium",
          tone === "when" && "bg-primary-soft text-primary",
          tone === "if" && "bg-warning/15 text-warning-text",
          tone === "then" && "bg-success/12 text-success-text",
        )}
      >
        {label}
      </span>
      <span className="truncate">{children}</span>
    </span>
  );
}

function AutomationCard({ automation, now }: { automation: Automation; now: number }) {
  const toggle = useCrm((s) => s.toggleAutomation);
  const remove = useCrm((s) => s.deleteAutomation);
  const members = useMemberMap();
  const router = useRouter();
  const [confirm, setConfirm] = React.useState(false);
  const memberName = (id: string) => members.get(id)?.name ?? "сотрудник";
  const scheduled = TRIGGERS.find((t) => t.type === automation.trigger.type)?.scheduled;

  return (
    <article className={cn("rounded-xl border bg-card p-5 shadow-card transition-[box-shadow,opacity] hover:shadow-raised", !automation.active && "opacity-70")}>
      <div className="flex items-start gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", automation.active ? "bg-warning/15 text-warning-text" : "bg-muted text-muted-foreground")}>
          <Zap className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/automations/${automation.id}`} className="text-[15px] font-semibold outline-none hover:underline focus-visible:underline">
            {automation.name}
          </Link>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{automation.description}</p>
        </div>
        <Switch
          checked={automation.active}
          onCheckedChange={() => {
            toggle(automation.id);
            toast(automation.active ? "Автоматизация выключена" : "Автоматизация включена", { description: automation.name });
          }}
          aria-label={automation.active ? "Выключить" : "Включить"}
        />
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-md p-1 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40" aria-label="Действия">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => router.push(`/automations/${automation.id}`)}>
              <Pencil />
              Изменить
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
              <Trash2 />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <FlowChip tone="when" label="Когда">
          {describeTrigger(automation)}
        </FlowChip>
        {automation.conditions.map((c) => (
          <React.Fragment key={c.id}>
            <ArrowRight className="size-3.5 text-muted-foreground/60" />
            <FlowChip tone="if" label="Если">
              {describeCondition(c, memberName)}
            </FlowChip>
          </React.Fragment>
        ))}
        {automation.actions.map((a) => (
          <React.Fragment key={a.id}>
            <ArrowRight className="size-3.5 text-muted-foreground/60" />
            <FlowChip tone="then" label="То">
              {describeAction(a, memberName)}
            </FlowChip>
          </React.Fragment>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <span>
          Сработала <span className="tabular font-medium text-foreground">{formatNumber(automation.runs)}</span> раз
        </span>
        {automation.lastRunAt && <span>последний раз {formatRelative(automation.lastRunAt, now)}</span>}
        {scheduled && (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            проверяется каждый час
          </span>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Удалить автоматизацию?"
        description={`«${automation.name}» перестанет работать. Уже созданные задачи и уведомления останутся.`}
        confirmLabel="Удалить"
        onConfirm={() => {
          remove(automation.id);
          toast("Автоматизация удалена", { description: automation.name });
        }}
      />
    </article>
  );
}

export function AutomationsView() {
  const ready = useReady();
  if (!ready) return <PageSkeleton variant="cards" />;
  return <Automations />;
}

function Automations() {
  const automations = useCrm((s) => s.automations);
  const now = useNow();
  const active = automations.filter((a) => a.active).length;
  const runs = automations.reduce((acc, a) => acc + a.runs, 0);
  const existing = new Set(automations.map((a) => a.name));
  const templates = AUTOMATION_TEMPLATES.map((t, index) => ({ ...t, index })).filter((t) => !existing.has(t.name));

  return (
    <div className="animate-page space-y-6">
      <PageHeader
        title="Автоматизации"
        description="Правила «когда → если → то» делают рутину за команду: распределяют заявки, ставят задачи, напоминают"
        actions={
          <Button asChild size="sm">
            <Link href="/automations/new">
              <Plus />
              Создать автоматизацию
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile icon={Workflow} label="Работают сейчас" value={`${active} из ${automations.length}`} />
        <StatTile icon={Zap} label="Срабатываний всего" value={formatNumber(runs)} />
        <StatTile
          icon={Clock}
          label="Сэкономлено времени"
          value={`≈ ${formatNumber(Math.round((runs * 4) / 60))} ч`}
          hint="Оценка: 4 минуты ручной работы на одно срабатывание"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {automations.length === 0 ? (
        <div className="rounded-xl border bg-card shadow-card">
          <EmptyState
            icon={Workflow}
            title="Пока нет автоматизаций"
            description="Начните с готового сценария — например, распределения заявок между менеджерами."
            action={
              <Button asChild size="sm">
                <Link href="/automations/new">
                  <Plus />
                  Создать автоматизацию
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {automations.map((a) => (
            <AutomationCard key={a.id} automation={a} now={now} />
          ))}
        </div>
      )}

      {templates.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
            <Sparkles className="size-4 text-primary" />
            Готовые сценарии
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => (
              <Link
                key={t.name}
                href={`/automations/new?template=${t.index}`}
                className="group rounded-xl border border-dashed bg-card/60 p-4 outline-none transition-colors hover:border-input hover:bg-card focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <h3 className="text-[14px] font-semibold">{t.name}</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">{t.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary group-hover:underline group-hover:underline-offset-4">
                  <Plus className="size-3.5" />
                  Создать по шаблону
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
