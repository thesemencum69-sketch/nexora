/**
 * Товары в сделке, счета и коммерческие предложения.
 * Отметка об оплате счёта сама закрывает сделку как выигранную.
 */
import type { DealDocument, DealItem, DocumentKind, ID } from "@/types/crm";
import { STAGE_BY_ID } from "@/lib/constants";
import { uid } from "@/lib/utils";
import { nowIso, type SliceContext } from "../slice-context";

export interface DocumentActions {
  setDealItems: (dealId: ID, items: DealItem[]) => void;
  createDocument: (dealId: ID, kind: DocumentKind) => DealDocument | null;
  markDocumentPaid: (documentId: ID) => { wonDealId: ID | null };
  cancelDocument: (documentId: ID) => void;
}

export const itemsTotal = (items: DealItem[]) => items.reduce((acc, item) => acc + item.price * item.qty, 0);

export function createDocumentActions({ set, get, log, touchClient }: SliceContext): DocumentActions {
  return {
    setDealItems: (dealId, items) => {
      const stamp = nowIso();
      set((s) => ({
        deals: s.deals.map((d) =>
          d.id === dealId ? { ...d, items, amount: items.length ? Math.round(itemsTotal(items)) : d.amount, updatedAt: stamp, lastActivityAt: stamp } : d,
        ),
      }));
    },

    createDocument: (dealId, kind) => {
      const deal = get().deals.find((d) => d.id === dealId);
      if (!deal) return null;
      const items: DealItem[] = deal.items?.length
        ? deal.items
        : [{ id: uid("item"), productId: null, name: deal.title, price: deal.amount, qty: 1, unit: "шт." }];
      const number = Math.max(0, ...get().documents.filter((d) => d.kind === kind).map((d) => d.number)) + 1;
      const doc: DealDocument = {
        id: uid("doc"),
        kind,
        number,
        dealId,
        clientId: deal.clientId,
        items,
        total: Math.round(itemsTotal(items)),
        status: "issued",
        createdAt: nowIso(),
        paidAt: null,
        createdBy: get().currentUserId,
      };
      set((s) => ({ documents: [doc, ...s.documents], deals: s.deals.map((d) => (d.id === dealId ? { ...d, lastActivityAt: doc.createdAt } : d)) }));
      log({ type: "document_issued", dealId, clientId: deal.clientId, meta: { kind, number, amount: doc.total, title: deal.title } });
      touchClient(deal.clientId);
      return doc;
    },

    markDocumentPaid: (documentId) => {
      const doc = get().documents.find((d) => d.id === documentId);
      if (!doc || doc.status === "paid") return { wonDealId: null };
      const stamp = nowIso();
      set((s) => ({ documents: s.documents.map((d) => (d.id === documentId ? { ...d, status: "paid", paidAt: stamp } : d)) }));
      log({ type: "document_paid", dealId: doc.dealId, clientId: doc.clientId, meta: { kind: doc.kind, number: doc.number, amount: doc.total } });
      const deal = get().deals.find((d) => d.id === doc.dealId);
      if (deal && !STAGE_BY_ID[deal.stage].closed) {
        get().moveDeal(deal.id, "won");
        return { wonDealId: deal.id };
      }
      return { wonDealId: null };
    },

    cancelDocument: (documentId) => set((s) => ({ documents: s.documents.map((d) => (d.id === documentId ? { ...d, status: "canceled" } : d)) })),
  };
}
