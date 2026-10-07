"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DocumentKind, ID } from "@/types/crm";
import { useCrm } from "@/hooks/use-crm";
import { celebrate } from "@/lib/celebrate";
import { formatMoney } from "@/lib/format";
import { useUi } from "@/lib/store/ui-store";
import { documentTitle } from "./document-meta";

/** Создание документа и отметка оплаты — одинаково из карточки сделки и со страницы документа */
export function useDocumentActions() {
  const router = useRouter();
  const createDocument = useCrm((s) => s.createDocument);
  const markDocumentPaid = useCrm((s) => s.markDocumentPaid);

  const create = (dealId: ID, kind: DocumentKind) => {
    const doc = createDocument(dealId, kind);
    if (!doc) return;
    useUi.getState().closeDeal();
    router.push(`/documents/${doc.id}`);
  };

  const markPaid = (documentId: ID) => {
    const doc = useCrm.getState().documents.find((d) => d.id === documentId);
    if (!doc) return;
    const { wonDealId } = markDocumentPaid(documentId);
    if (wonDealId) {
      celebrate();
      toast.success("Оплата получена — сделка выиграна", { description: `${documentTitle(doc)}, ${formatMoney(doc.total)}` });
    } else {
      toast.success("Счёт отмечен оплаченным", { description: documentTitle(doc) });
    }
  };

  return { create, markPaid };
}
