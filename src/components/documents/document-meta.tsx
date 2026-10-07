import type { DealDocument, DocumentKind, DocumentStatus } from "@/types/crm";
import { Badge } from "@/components/ui/badge";

export const DOCUMENT_KINDS: Record<DocumentKind, { label: string; short: string }> = {
  invoice: { label: "Счёт на оплату", short: "Счёт" },
  proposal: { label: "Коммерческое предложение", short: "КП" },
};

export const documentTitle = (doc: Pick<DealDocument, "kind" | "number">) => `${DOCUMENT_KINDS[doc.kind].short} № ${doc.number}`;

export function DocumentStatusBadge({ status, kind }: { status: DocumentStatus; kind: DocumentKind }) {
  if (status === "paid") return <Badge variant="success" size="sm">Оплачен</Badge>;
  if (status === "canceled") return <Badge variant="muted" size="sm">Отменён</Badge>;
  return (
    <Badge variant={kind === "invoice" ? "warning" : "brand"} size="sm">
      {kind === "invoice" ? "Ждёт оплаты" : "Отправлено"}
    </Badge>
  );
}
