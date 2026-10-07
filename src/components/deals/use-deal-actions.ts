"use client";

import { toast } from "sonner";
import type { Deal, DealStageId } from "@/types/crm";
import { stageLabel } from "@/lib/stages";
import { formatMoney } from "@/lib/format";
import { useCrm } from "@/hooks/use-crm";
import { useUi } from "@/lib/store/ui-store";
import { celebrate } from "@/lib/celebrate";

/** Перемещение сделки с понятной обратной связью и возможностью отменить */
export function useDealActions() {
  const moveDeal = useCrm((s) => s.moveDeal);
  const askLostReason = useUi((s) => s.askLostReason);

  const move = (deal: Deal, stage: DealStageId) => {
    if (deal.stage === stage) return;
    if (stage === "lost") {
      askLostReason(deal.id);
      return;
    }
    const from = deal.stage;
    moveDeal(deal.id, stage);
    if (stage === "won") {
      celebrate();
      toast.success("Сделка выиграна", {
        description: `${deal.title} — ${formatMoney(deal.amount)} в выручку`,
        action: { label: "Отменить", onClick: () => moveDeal(deal.id, from) },
      });
      return;
    }
    toast(`Сделка перемещена в «${stageLabel(stage)}»`, {
      description: deal.title,
      action: { label: "Отменить", onClick: () => moveDeal(deal.id, from) },
    });
  };

  return { move };
}
