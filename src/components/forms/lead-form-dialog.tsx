"use client";

import * as React from "react";
import { toast } from "sonner";
import type { LeadSource } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useCrm } from "@/hooks/use-crm";
import { SOURCE_BY_ID } from "@/lib/constants";
import { useUi, type DialogPrefill } from "@/lib/store/ui-store";
import { fieldErrors, leadSchema, type FieldErrors } from "@/lib/validators";
import { MemberSelect, SourceSelect } from "./form-controls";
import { DuplicateHint } from "./duplicate-hint";
import { useDuplicate } from "./use-duplicate";

export function LeadFormDialog({ open, prefill }: { open: boolean; prefill: DialogPrefill }) {
  const close = useUi((s) => s.closeDialog);
  const me = useCrm((s) => s.currentUserId);
  const createLead = useCrm((s) => s.createLead);

  const [form, setForm] = React.useState({ name: "", company: "", phone: "", email: "", message: "", budget: "" });
  const [source, setSource] = React.useState<LeadSource>("website");
  const [ownerId, setOwnerId] = React.useState(me);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const duplicate = useDuplicate(form.phone, form.email);

  React.useEffect(() => {
    if (!open) return;
    setForm({ name: "", company: "", phone: "", email: "", message: "", budget: "" });
    setSource(prefill.source ?? "website");
    setOwnerId(prefill.ownerId ?? me);
    setErrors({});
  }, [open, prefill, me]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = leadSchema.safeParse({
      ...form,
      source,
      ownerId,
      budget: form.budget.replace(/\s/g, "") ? form.budget.replace(/\s/g, "") : null,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    const lead = createLead(parsed.data);
    close();
    toast.success("Лид добавлен", { description: `${lead.name}, заявка ${SOURCE_BY_ID[lead.source].from}` });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Новый лид</DialogTitle>
          <DialogDescription>Заявки из подключённых каналов попадают сюда автоматически. Здесь — ручное добавление.</DialogDescription>
        </DialogHeader>
        <form id="lead-form" onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Имя" htmlFor="lead-name" error={errors.name}>
              <Input id="lead-name" autoFocus value={form.name} onChange={set("name")} placeholder="Мария Иванова" aria-invalid={Boolean(errors.name)} />
            </Field>
            <Field label="Компания" htmlFor="lead-company">
              <Input id="lead-company" value={form.company} onChange={set("company")} placeholder="Необязательно" />
            </Field>
            <Field label="Телефон" htmlFor="lead-phone" error={errors.phone}>
              <Input id="lead-phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="+7 900 000-00-00" aria-invalid={Boolean(errors.phone)} />
            </Field>
            <Field label="Email" htmlFor="lead-email" error={errors.email}>
              <Input id="lead-email" type="email" value={form.email} onChange={set("email")} placeholder="name@company.ru" aria-invalid={Boolean(errors.email)} />
            </Field>
          </div>
          <DuplicateHint client={duplicate.client} lead={duplicate.lead} onNavigate={close} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Источник" htmlFor="lead-source">
              <SourceSelect id="lead-source" value={source} onChange={setSource} />
            </Field>
            <Field label="Ответственный" htmlFor="lead-owner">
              <MemberSelect id="lead-owner" value={ownerId} onChange={setOwnerId} />
            </Field>
            <Field label="Бюджет, ₽" htmlFor="lead-budget">
              <Input
                id="lead-budget"
                inputMode="numeric"
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value.replace(/[^\d\s]/g, "") }))}
                placeholder="Если известен"
              />
            </Field>
          </div>
          <Field label="Запрос клиента" htmlFor="lead-message">
            <Textarea id="lead-message" value={form.message} onChange={set("message")} placeholder="Что хочет клиент, сроки, детали" rows={3} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Отмена
          </Button>
          <Button type="submit" form="lead-form">
            Добавить лида
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
