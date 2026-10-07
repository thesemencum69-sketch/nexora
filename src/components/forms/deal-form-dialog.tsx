"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { celebrate } from "@/lib/celebrate";
import { toast } from "sonner";
import type { DealStageId, Priority } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { SERVICES } from "@/lib/demo/catalog";
import { useCrm } from "@/hooks/use-crm";
import { formatMoney } from "@/lib/format";
import { useUi, type DialogPrefill } from "@/lib/store/ui-store";
import { addDays, atTime } from "@/lib/time";
import { dealSchema, fieldErrors, type FieldErrors } from "@/lib/validators";
import {
  EntityCombobox,
  MemberSelect,
  PriorityPicker,
  QuickDates,
  StageSelect,
  closeQuickOptions,
  fromInputs,
  toDateInput,
} from "./form-controls";

export function DealFormDialog({ open, prefill }: { open: boolean; prefill: DialogPrefill }) {
  const close = useUi((s) => s.closeDialog);
  const openDeal = useUi((s) => s.openDeal);
  const openDialog = useUi((s) => s.openDialog);
  const clients = useCrm((s) => s.clients);
  const me = useCrm((s) => s.currentUserId);
  const createDeal = useCrm((s) => s.createDeal);
  const router = useRouter();

  const [title, setTitle] = React.useState("");
  const [clientId, setClientId] = React.useState<string | null>(null);
  const [amount, setAmount] = React.useState("");
  const [stage, setStage] = React.useState<DealStageId>("new");
  const [ownerId, setOwnerId] = React.useState(me);
  const [priority, setPriority] = React.useState<Priority>("medium");
  const [closeDate, setCloseDate] = React.useState(() => toDateInput(atTime(addDays(Date.now(), 14), 18)));
  const [errors, setErrors] = React.useState<FieldErrors>({});

  React.useEffect(() => {
    if (!open) return;
    setTitle(prefill.title ?? "");
    setClientId(prefill.clientId ?? null);
    setAmount("");
    setStage(prefill.stage ?? "new");
    setOwnerId(prefill.ownerId ?? me);
    setPriority(prefill.priority ?? "medium");
    setCloseDate(toDateInput(atTime(addDays(Date.now(), 14), 18)));
    setErrors({});
  }, [open, prefill, me]);

  const clientItems = React.useMemo(() => clients.map((c) => ({ id: c.id, label: c.company || c.name, sub: c.company ? c.name : "Частное лицо" })), [clients]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = dealSchema.safeParse({
      title,
      clientId: clientId ?? "",
      amount: amount.replace(/\s/g, "") || 0,
      stage,
      ownerId,
      priority,
      expectedCloseAt: closeDate,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    const deal = createDeal({ ...parsed.data, expectedCloseAt: fromInputs(parsed.data.expectedCloseAt, "18:00") });
    close();
    if (deal.stage === "won") celebrate();
    toast.success("Сделка создана", {
      description: `${deal.title} — ${formatMoney(deal.amount)}`,
      action: {
        label: "Открыть",
        onClick: () => {
          router.push("/deals");
          openDeal(deal.id);
        },
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Новая сделка</DialogTitle>
          <DialogDescription>Сделка появится на канбане в выбранном этапе.</DialogDescription>
        </DialogHeader>
        <form id="deal-form" onSubmit={submit} className="grid gap-4" noValidate>
          <Field label="Название" htmlFor="deal-title" error={errors.title}>
            <Input
              id="deal-title"
              autoFocus
              list="deal-title-suggestions"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например, корпоративный сайт"
              aria-invalid={Boolean(errors.title)}
            />
            <datalist id="deal-title-suggestions">
              {SERVICES.map((s) => (
                <option key={s.title} value={s.title} />
              ))}
            </datalist>
          </Field>
          <Field label="Клиент" htmlFor="deal-client" error={errors.clientId}>
            <EntityCombobox
              id="deal-client"
              items={clientItems}
              value={clientId}
              onChange={setClientId}
              placeholder="Найдите компанию или контакт"
              invalid={Boolean(errors.clientId)}
              footer={
                <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={() => openDialog("client", { then: "deal" })}>
                  + Добавить нового клиента
                </Button>
              }
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Сумма, ₽" htmlFor="deal-amount" error={errors.amount}>
              <Input
                id="deal-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d\s]/g, ""))}
                placeholder="150 000"
                className="tabular"
              />
            </Field>
            <Field label="Этап" htmlFor="deal-stage">
              <StageSelect id="deal-stage" value={stage} onChange={setStage} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ответственный" htmlFor="deal-owner">
              <MemberSelect id="deal-owner" value={ownerId} onChange={setOwnerId} />
            </Field>
            <Field label="Ожидаемая дата закрытия" htmlFor="deal-close" error={errors.expectedCloseAt}>
              <Input id="deal-close" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
            </Field>
          </div>
          <QuickDates options={closeQuickOptions(Date.now())} onPick={(ms) => setCloseDate(toDateInput(ms))} />
          <Field label="Приоритет">
            <PriorityPicker value={priority} onChange={setPriority} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Отмена
          </Button>
          <Button type="submit" form="deal-form">
            Создать сделку
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
