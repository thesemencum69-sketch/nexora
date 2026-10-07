"use client";

import * as React from "react";
import { toast } from "sonner";
import type { Priority } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useClientMap, useCrm } from "@/hooks/use-crm";
import { formatDue } from "@/lib/format";
import { isOpen } from "@/lib/metrics";
import { useUi, type DialogPrefill } from "@/lib/store/ui-store";
import { addDays, atTime } from "@/lib/time";
import { fieldErrors, taskSchema, type FieldErrors } from "@/lib/validators";
import { EntityCombobox, MemberSelect, PriorityPicker, QuickDates, dueQuickOptions, fromInputs, toDateInput, toTimeInput } from "./form-controls";
import { accountName } from "@/lib/display";

export function TaskFormDialog({ open, prefill }: { open: boolean; prefill: DialogPrefill }) {
  const close = useUi((s) => s.closeDialog);
  const me = useCrm((s) => s.currentUserId);
  const deals = useCrm((s) => s.deals);
  const clients = useCrm((s) => s.clients);
  const members = useCrm((s) => s.members);
  const createTask = useCrm((s) => s.createTask);
  const clientMap = useClientMap();

  const defaultDue = () => atTime(addDays(Date.now(), 1), 10);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState(me);
  const [date, setDate] = React.useState(() => toDateInput(defaultDue()));
  const [time, setTime] = React.useState("10:00");
  const [priority, setPriority] = React.useState<Priority>("medium");
  const [dealId, setDealId] = React.useState<string | null>(null);
  const [clientId, setClientId] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<FieldErrors>({});

  React.useEffect(() => {
    if (!open) return;
    const due = prefill.dueAt ? Date.parse(prefill.dueAt) : defaultDue();
    setTitle(prefill.title ?? "");
    setDescription("");
    setAssigneeId(prefill.ownerId ?? me);
    setDate(toDateInput(due));
    setTime(toTimeInput(due));
    setPriority(prefill.priority ?? "medium");
    setDealId(prefill.dealId ?? null);
    const linkedDeal = prefill.dealId ? useCrm.getState().deals.find((d) => d.id === prefill.dealId) : undefined;
    setClientId(prefill.clientId ?? linkedDeal?.clientId ?? null);
    setErrors({});
  }, [open, prefill, me]);

  const dealItems = React.useMemo(
    () => deals.filter((d) => isOpen(d) || d.id === dealId).map((d) => ({ id: d.id, label: d.title, sub: accountName(clientMap.get(d.clientId)) })),
    [deals, clientMap, dealId],
  );
  const clientItems = React.useMemo(() => clients.map((c) => ({ id: c.id, label: c.company || c.name, sub: c.company ? c.name : "Частное лицо" })), [clients]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = taskSchema.safeParse({ title, description, assigneeId, dueAt: date, priority, dealId, clientId });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    const task = createTask({ ...parsed.data, dueAt: fromInputs(date, time) });
    close();
    const who = members.find((m) => m.id === task.assigneeId);
    toast.success("Задача поставлена", {
      description: `${task.title}. ${formatDue(task.dueAt)}${who && who.id !== me ? `, ${who.name}` : ""}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Новая задача</DialogTitle>
          <DialogDescription>Привяжите к сделке или клиенту — задача появится в их карточках.</DialogDescription>
        </DialogHeader>
        <form id="task-form" onSubmit={submit} className="grid gap-4" noValidate>
          <Field label="Что сделать" htmlFor="task-title" error={errors.title}>
            <Input id="task-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Позвонить и обсудить КП" aria-invalid={Boolean(errors.title)} />
          </Field>
          <Field label="Описание" htmlFor="task-description">
            <Textarea id="task-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Детали, ссылки, контекст" rows={2} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_140px_110px]">
            <Field label="Ответственный" htmlFor="task-assignee">
              <MemberSelect id="task-assignee" value={assigneeId} onChange={setAssigneeId} />
            </Field>
            <Field label="Срок" htmlFor="task-date" error={errors.dueAt}>
              <Input id="task-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Время" htmlFor="task-time">
              <Input id="task-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <QuickDates
            options={dueQuickOptions(Date.now())}
            onPick={(ms) => {
              setDate(toDateInput(ms));
              setTime(toTimeInput(ms));
            }}
          />
          <Field label="Приоритет">
            <PriorityPicker value={priority} onChange={setPriority} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Сделка" htmlFor="task-deal">
              <EntityCombobox
                id="task-deal"
                items={dealItems}
                value={dealId}
                allowClear
                onChange={(id) => {
                  setDealId(id);
                  const deal = deals.find((d) => d.id === id);
                  if (deal) setClientId(deal.clientId);
                }}
                placeholder="Без сделки"
              />
            </Field>
            <Field label="Клиент" htmlFor="task-client">
              <EntityCombobox id="task-client" items={clientItems} value={clientId} allowClear onChange={setClientId} placeholder="Без клиента" />
            </Field>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Отмена
          </Button>
          <Button type="submit" form="task-form">
            Поставить задачу
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
