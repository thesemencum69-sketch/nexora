"use client";

import * as React from "react";
import type { Client, Lead } from "@/types/crm";
import { useCrm } from "@/hooks/use-crm";
import { digitsOnly } from "@/lib/utils";

/**
 * Поиск дублей по телефону и email прямо во время ввода — чтобы один клиент
 * не превращался в три карточки (частая боль в популярных CRM).
 */
export function useDuplicate(phone: string, email: string): { client?: Client; lead?: Lead } {
  const clients = useCrm((s) => s.clients);
  const leads = useCrm((s) => s.leads);
  const deferredPhone = React.useDeferredValue(digitsOnly(phone).slice(-10));
  const deferredEmail = React.useDeferredValue(email.trim().toLowerCase());

  return React.useMemo(() => {
    const phoneMatch = (value: string) => deferredPhone.length >= 10 && digitsOnly(value).slice(-10) === deferredPhone;
    const emailMatch = (value: string) => deferredEmail.includes("@") && value.toLowerCase() === deferredEmail;
    const client = clients.find((c) => phoneMatch(c.phone) || emailMatch(c.email));
    const lead = client ? undefined : leads.find((l) => phoneMatch(l.phone) || emailMatch(l.email));
    return { client, lead };
  }, [clients, leads, deferredPhone, deferredEmail]);
}
