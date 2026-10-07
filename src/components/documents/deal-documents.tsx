"use client";

import * as React from "react";
import Link from "next/link";
import { CircleCheck, FileText, MoreHorizontal } from "lucide-react";
import type { Deal } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCrm, useNow } from "@/hooks/use-crm";
import { formatDate, formatMoney } from "@/lib/format";
import { useUi } from "@/lib/store/ui-store";
import { DocumentStatusBadge, documentTitle } from "./document-meta";
import { useDocumentActions } from "./use-document-actions";

/** Документы сделки: счета и КП со статусом оплаты */
export function DealDocuments({ deal }: { deal: Deal }) {
  const documents = useCrm((s) => s.documents);
  const cancelDocument = useCrm((s) => s.cancelDocument);
  const { create, markPaid } = useDocumentActions();
  const closeDeal = useUi((s) => s.closeDeal);
  const now = useNow();
  const list = React.useMemo(() => documents.filter((d) => d.dealId === deal.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [documents, deal.id]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => create(deal.id, "invoice")}>
          <FileText />
          Выставить счёт
        </Button>
        <Button variant="outline" size="sm" onClick={() => create(deal.id, "proposal")}>
          <FileText />
          Создать КП
        </Button>
      </div>
      {list.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Документы соберутся из сделки за один клик: товары, суммы и реквизиты подставятся сами.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {list.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="size-4" />
              </span>
              <Link href={`/documents/${doc.id}`} onClick={closeDeal} className="min-w-0 flex-1 hover:underline">
                <span className="block truncate text-[13px] font-medium">{documentTitle(doc)}</span>
                <span className="tabular block text-xs text-muted-foreground">
                  {formatDate(doc.createdAt, now)}, {formatMoney(doc.total)}
                </span>
              </Link>
              <DocumentStatusBadge status={doc.status} kind={doc.kind} />
              {doc.kind === "invoice" && doc.status === "issued" ? (
                <Button size="xs" variant="outline" onClick={() => markPaid(doc.id)}>
                  <CircleCheck className="text-success-text" />
                  Оплачен
                </Button>
              ) : null}
              {doc.status === "issued" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-xs" aria-label="Действия с документом">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => cancelDocument(doc.id)}>Отменить документ</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
