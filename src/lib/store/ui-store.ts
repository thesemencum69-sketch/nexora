import { create } from "zustand";
import type { DealStageId, ID, LeadSource, Priority } from "@/types/crm";

export type DialogKind = "deal" | "lead" | "client" | "task";

export interface DialogPrefill {
  stage?: DealStageId;
  clientId?: ID;
  dealId?: ID;
  leadId?: ID;
  ownerId?: ID;
  priority?: Priority;
  source?: LeadSource;
  title?: string;
  /** ISO-дата срока задачи */
  dueAt?: string;
  /** какую форму открыть после сохранения (например, вернуться к сделке после создания клиента) */
  then?: "deal";
}

interface UiState {
  commandOpen: boolean;
  shortcutsOpen: boolean;
  mobileMenuOpen: boolean;
  dialog: { kind: DialogKind; prefill: DialogPrefill } | null;
  dealId: ID | null;
  /** сделка, для которой спрашиваем причину проигрыша */
  lostDealId: ID | null;

  setCommandOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;
  openDialog: (kind: DialogKind, prefill?: DialogPrefill) => void;
  closeDialog: () => void;
  openDeal: (id: ID) => void;
  closeDeal: () => void;
  askLostReason: (id: ID | null) => void;
}

/** Глобальные окна: один экземпляр на приложение, открываются откуда угодно */
export const useUi = create<UiState>()((set) => ({
  commandOpen: false,
  shortcutsOpen: false,
  mobileMenuOpen: false,
  dialog: null,
  dealId: null,
  lostDealId: null,

  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
  openDialog: (kind, prefill = {}) => set({ dialog: { kind, prefill }, commandOpen: false, mobileMenuOpen: false }),
  closeDialog: () => set({ dialog: null }),
  openDeal: (dealId) => set({ dealId, commandOpen: false }),
  closeDeal: () => set({ dealId: null }),
  askLostReason: (lostDealId) => set({ lostDealId }),
}));
