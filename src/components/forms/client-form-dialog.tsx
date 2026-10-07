"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { LeadSource } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useCrm } from "@/hooks/use-crm";
import { useUi, type DialogPrefill } from "@/lib/store/ui-store";
import { clientSchema, fieldErrors, type FieldErrors } from "@/lib/validators";
import { MemberSelect, SourceSelect } from "./form-controls";
import { DuplicateHint } from "./duplicate-hint";
import { useDuplicate } from "./use-duplicate";
import { contactLine } from "@/lib/display";

export function ClientFormDialog({ open, prefill }: { open: boolean; prefill: DialogPrefill }) {
  const close = useUi((s) => s.closeDialog);
  const openDialog = useUi((s) => s.openDialog);
  const me = useCrm((s) => s.currentUserId);
  const createClient = useCrm((s) => s.createClient);
  const router = useRouter();

  const [form, setForm] = React.useState({ name: "", company: "", phone: "", email: "", city: "" });
  const [source, setSource] = React.useState<LeadSource>("referral");
  const [ownerId, setOwnerId] = React.useState(me);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const duplicate = useDuplicate(form.phone, form.email);

  React.useEffect(() => {
    if (!open) return;
    setForm({ name: "", company: "", phone: "", email: "", city: "" });
    setSource(prefill.source ?? "referral");
    setOwnerId(prefill.ownerId ?? me);
    setErrors({});
  }, [open, prefill, me]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = clientSchema.safeParse({ ...form, source, ownerId });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    const client = createClient(parsed.data);
    if (prefill.then === "deal") openDialog("deal", { clientId: client.id });
    else close();
    toast.success("Клиент добавлен", {
      description: contactLine(client),
      action: { label: "Открыть", onClick: () => router.push(`/clients/${client.id}`) },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Новый клиент</DialogTitle>
          <DialogDescription>Контакт и компания. Сделки и задачи можно добавить сразу после.</DialogDescription>
        </DialogHeader>
        <form id="client-form" onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Контактное лицо" htmlFor="client-name" error={errors.name}>
              <Input id="client-name" autoFocus value={form.name} onChange={set("name")} placeholder="Иван Петров" aria-invalid={Boolean(errors.name)} />
            </Field>
            <Field label="Компания" htmlFor="client-company" error={errors.company}>
              <Input id="client-company" value={form.company} onChange={set("company")} placeholder="Необязательно — для частного лица оставьте пустым" aria-invalid={Boolean(errors.company)} />
            </Field>
            <Field label="Телефон" htmlFor="client-phone" error={errors.phone}>
              <Input id="client-phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="+7 900 000-00-00" aria-invalid={Boolean(errors.phone)} />
            </Field>
            <Field label="Email" htmlFor="client-email" error={errors.email}>
              <Input id="client-email" type="email" value={form.email} onChange={set("email")} placeholder="name@company.ru" aria-invalid={Boolean(errors.email)} />
            </Field>
          </div>
          <DuplicateHint client={duplicate.client} lead={duplicate.lead} onNavigate={close} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Город" htmlFor="client-city">
              <Input id="client-city" value={form.city} onChange={set("city")} placeholder="Москва" />
            </Field>
            <Field label="Источник" htmlFor="client-source">
              <SourceSelect id="client-source" value={source} onChange={setSource} />
            </Field>
            <Field label="Ответственный" htmlFor="client-owner">
              <MemberSelect id="client-owner" value={ownerId} onChange={setOwnerId} />
            </Field>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Отмена
          </Button>
          <Button type="submit" form="client-form">
            Добавить клиента
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
