"use client";

import Link from "next/link";
import { CopyCheck } from "lucide-react";
import type { Client, Lead } from "@/types/crm";
import { contactLine } from "@/lib/display";

export function DuplicateHint({ client, lead, onNavigate }: { client?: Client; lead?: Lead; onNavigate?: () => void }) {
  if (!client && !lead) return null;
  return (
    <div role="status" className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-[13px]">
      <CopyCheck className="mt-0.5 size-4 shrink-0 text-warning-text" />
      <p className="leading-snug">
        {client ? (
          <>
            Такой контакт уже есть:{" "}
            <Link href={`/clients/${client.id}`} onClick={onNavigate} className="font-medium underline underline-offset-2">
              {contactLine(client)}
            </Link>
            . Проверьте, не дубль ли это.
          </>
        ) : (
          <>
            Похожий лид уже есть: <span className="font-medium">{lead!.name}</span>
            {lead!.company ? `, ${lead!.company}` : ""}. Проверьте, не дубль ли это.
          </>
        )}
      </p>
    </div>
  );
}
