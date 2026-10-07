"use client";

import { useUi } from "@/lib/store/ui-store";
import { ClientFormDialog } from "./client-form-dialog";
import { DealFormDialog } from "./deal-form-dialog";
import { LeadFormDialog } from "./lead-form-dialog";
import { TaskFormDialog } from "./task-form-dialog";

const EMPTY = {};

/** Все формы создания живут в одном месте и открываются из любого экрана */
export function GlobalDialogs() {
  const dialog = useUi((s) => s.dialog);
  const prefill = dialog?.prefill ?? EMPTY;
  return (
    <>
      <DealFormDialog open={dialog?.kind === "deal"} prefill={prefill} />
      <LeadFormDialog open={dialog?.kind === "lead"} prefill={prefill} />
      <ClientFormDialog open={dialog?.kind === "client"} prefill={prefill} />
      <TaskFormDialog open={dialog?.kind === "task"} prefill={prefill} />
    </>
  );
}
