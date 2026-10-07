import type { StoreApi } from "zustand";
import type { Activity, ID } from "@/types/crm";
import type { AutomationEvent } from "@/lib/automation-engine";
import type { CrmStore } from "./crm-store";

/** Общие помощники, которые ядро хранилища передаёт частям (slices) */
export interface SliceContext {
  set: StoreApi<CrmStore>["setState"];
  get: StoreApi<CrmStore>["getState"];
  log: (activity: Omit<Activity, "id" | "createdAt" | "actorId"> & { actorId?: ID | null }) => void;
  touchClient: (clientId: ID | null | undefined) => void;
  fire: (event: AutomationEvent) => void;
  /** выполняет пачку действий, собирая уведомления автоматизаций в одно */
  batch: <T>(run: () => T) => T;
}

export const nowIso = () => new Date().toISOString();
