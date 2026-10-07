"use client";

import { useEffect, useMemo, useState } from "react";
import type { Client, Deal, ID, Member } from "@/types/crm";
import { useCrm } from "@/lib/store/crm-store";
import { MINUTE } from "@/lib/time";
import { packFor } from "@/config/industries";

export { useCrm };

export const useReady = () => useCrm((s) => s.ready);

export function useCurrentUser(): Member | undefined {
  return useCrm((s) => s.members.find((m) => m.id === s.currentUserId));
}

export function useMemberMap() {
  const members = useCrm((s) => s.members);
  return useMemo(() => new Map<ID, Member>(members.map((m) => [m.id, m])), [members]);
}

export function useClientMap() {
  const clients = useCrm((s) => s.clients);
  return useMemo(() => new Map<ID, Client>(clients.map((c) => [c.id, c])), [clients]);
}

export function useDealMap() {
  const deals = useCrm((s) => s.deals);
  return useMemo(() => new Map<ID, Deal>(deals.map((d) => [d.id, d])), [deals]);
}

/**
 * Текущее время, обновляется раз в минуту. Все относительные даты и метрики
 * считаются от него — интерфейс не «застывает», если вкладка открыта долго.
 */
export function useNow(intervalMs = MINUTE) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Причины отказа под сферу компании: у клиники и стройки они разные */
export function useLostReasons(): readonly string[] {
  const industry = useCrm((s) => s.workspace.industry);
  return useMemo(() => packFor(industry).lostReasons, [industry]);
}
