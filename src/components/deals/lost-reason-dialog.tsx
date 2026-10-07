"use client";

import * as React from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { useCrm, useLostReasons } from "@/hooks/use-crm";
import { useUi } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

/** Причина проигрыша — без неё аналитика отказов бесполезна */
export function LostReasonDialog() {
  const lostDealId = useUi((s) => s.lostDealId);
  const askLostReason = useUi((s) => s.askLostReason);
  const deal = useCrm((s) => s.deals.find((d) => d.id === lostDealId));
  const moveDeal = useCrm((s) => s.moveDeal);
  const reasons = useLostReasons();
  const [reason, setReason] = React.useState<string>(reasons[0]!);

  React.useEffect(() => {
    if (lostDealId) setReason(reasons[0]!);
  }, [lostDealId, reasons]);

  return (
    <ConfirmDialog
      open={Boolean(deal)}
      onOpenChange={(open) => !open && askLostReason(null)}
      title="Сделка проиграна?"
      description={deal ? `«${deal.title}» уйдёт в «Провалено». Укажите причину — она попадёт в отчёт по отказам.` : undefined}
      confirmLabel="Отметить проигранной"
      onConfirm={() => {
        if (!deal) return;
        const from = deal.stage;
        moveDeal(deal.id, "lost", reason);
        askLostReason(null);
        toast("Сделка отмечена проигранной", {
          description: `${deal.title}: ${reason.toLowerCase()}`,
          action: { label: "Отменить", onClick: () => moveDeal(deal.id, from) },
        });
      }}
    >
      <div role="radiogroup" aria-label="Причина" className="flex flex-wrap gap-1.5">
        {reasons.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={reason === r}
            onClick={() => setReason(r)}
            className={cn(
              "h-8 rounded-full border px-3 text-[13px] transition-colors",
              reason === r ? "border-foreground/25 bg-accent font-medium text-foreground" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {r}
          </button>
        ))}
      </div>
    </ConfirmDialog>
  );
}
