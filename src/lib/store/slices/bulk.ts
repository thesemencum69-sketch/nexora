/**
 * Массовые действия с выбранными записями и импорт из файлов.
 * Импорт создаёт записи напрямую, без автоматизаций: загрузка базы
 * из старой CRM не должна порождать сотни задач и уведомлений.
 */
import type { Client, CustomValues, Deal, DealStageId, ID, ImportBatch, Lead, LeadSource, LeadStatus, Priority } from "@/types/crm";
import { STAGE_BY_ID, STAGE_REACH } from "@/lib/constants";
import { DAY, iso } from "@/lib/time";
import { uid } from "@/lib/utils";
import { nowIso, type SliceContext } from "../slice-context";

export interface ImportRow {
  client?: { name: string; company: string; phone: string; email: string; city: string; source: LeadSource; ownerId: ID; custom?: CustomValues };
  /** клиент уже есть в CRM — найден по телефону или email */
  existingClientId?: ID | null;
  deal?: { title: string; amount: number; stage: DealStageId; ownerId: ID; createdAt?: string };
  lead?: { name: string; company: string; phone: string; email: string; source: LeadSource; ownerId: ID; message: string; budget: number | null };
}

export interface BulkActions {
  bulkUpdateDeals: (ids: ID[], patch: { ownerId?: ID; priority?: Priority }) => void;
  bulkMoveDeals: (ids: ID[], stage: DealStageId, lostReason?: string) => void;
  bulkDeleteDeals: (ids: ID[]) => void;
  bulkUpdateClients: (ids: ID[], patch: { ownerId?: ID }) => void;
  bulkDeleteClients: (ids: ID[]) => void;
  bulkUpdateLeads: (ids: ID[], patch: { ownerId?: ID; status?: LeadStatus }) => void;
  bulkDeleteLeads: (ids: ID[]) => void;
  importRecords: (fileName: string, rows: ImportRow[]) => ImportBatch;
  undoImport: (batchId: ID) => void;
}

const gender = (name: string) => (/а$|я$/.test(name.trim().split(/\s+/)[0] ?? "") ? "f" : "m");

export function createBulkActions({ set, get, batch }: SliceContext): BulkActions {
  return {
    bulkUpdateDeals: (ids, patch) => {
      const selected = new Set(ids);
      const stamp = nowIso();
      set((s) => ({ deals: s.deals.map((d) => (selected.has(d.id) ? { ...d, ...patch, updatedAt: stamp } : d)) }));
    },
    bulkMoveDeals: (ids, stage, lostReason) => batch(() => ids.forEach((id) => get().moveDeal(id, stage, lostReason))),
    bulkDeleteDeals: (ids) => {
      const selected = new Set(ids);
      set((s) => ({
        deals: s.deals.filter((d) => !selected.has(d.id)),
        tasks: s.tasks.map((t) => (t.dealId && selected.has(t.dealId) ? { ...t, dealId: null } : t)),
        notes: s.notes.map((n) => (n.dealId && selected.has(n.dealId) ? { ...n, dealId: null } : n)),
        documents: s.documents.filter((d) => !selected.has(d.dealId)),
        conversations: s.conversations.map((c) => (c.dealId && selected.has(c.dealId) ? { ...c, dealId: null } : c)),
      }));
    },

    bulkUpdateClients: (ids, patch) => {
      const selected = new Set(ids);
      set((s) => ({ clients: s.clients.map((c) => (selected.has(c.id) ? { ...c, ...patch } : c)) }));
    },
    bulkDeleteClients: (ids) => {
      const selected = new Set(ids);
      set((s) => {
        const dealIds = new Set(s.deals.filter((d) => selected.has(d.clientId)).map((d) => d.id));
        return {
          clients: s.clients.filter((c) => !selected.has(c.id)),
          deals: s.deals.filter((d) => !selected.has(d.clientId)),
          tasks: s.tasks.filter((t) => !(t.clientId && selected.has(t.clientId)) && !(t.dealId && dealIds.has(t.dealId))),
          notes: s.notes.filter((n) => !(n.clientId && selected.has(n.clientId))),
          documents: s.documents.filter((d) => !selected.has(d.clientId)),
          conversations: s.conversations.map((c) => (c.clientId && selected.has(c.clientId) ? { ...c, clientId: null, dealId: null } : c)),
        };
      });
    },

    bulkUpdateLeads: (ids, patch) => {
      const selected = new Set(ids);
      const stamp = nowIso();
      set((s) => ({
        leads: s.leads.map((l) => {
          if (!selected.has(l.id)) return l;
          // ставший сделкой лид не возвращаем в работу и не отмечаем отказом
          const next = l.status === "converted" ? { ...l, ownerId: patch.ownerId ?? l.ownerId } : { ...l, ...patch };
          if (patch.status && patch.status !== "new" && !l.firstResponseAt) next.firstResponseAt = stamp;
          return next;
        }),
      }));
    },
    bulkDeleteLeads: (ids) => {
      const selected = new Set(ids);
      set((s) => ({
        leads: s.leads.filter((l) => !selected.has(l.id)),
        conversations: s.conversations.filter((c) => !(c.leadId && selected.has(c.leadId) && !c.clientId)),
      }));
    },

    importRecords: (fileName, rows) => {
      const stamp = nowIso();
      const clients: Client[] = [];
      const deals: Deal[] = [];
      const leads: Lead[] = [];
      // одна и та же компания в нескольких строках файла — один клиент
      const createdByKey = new Map<string, ID>();
      const keyOf = (c: { phone: string; email: string }) => c.phone.replace(/\D/g, "").slice(-10) || c.email.toLowerCase();
      for (const row of rows) {
        let clientId = row.existingClientId ?? (row.client && keyOf(row.client) ? (createdByKey.get(keyOf(row.client)) ?? null) : null);
        if (!clientId && row.client) {
          const client: Client = {
            id: uid("client"),
            ...row.client,
            gender: gender(row.client.name),
            tags: [],
            createdAt: stamp,
            lastActivityAt: stamp,
          };
          clients.push(client);
          clientId = client.id;
          if (keyOf(client)) createdByKey.set(keyOf(client), client.id);
        }
        if (row.deal && clientId) {
          const created = row.deal.createdAt && !Number.isNaN(Date.parse(row.deal.createdAt)) ? new Date(row.deal.createdAt).toISOString() : stamp;
          const closed = STAGE_BY_ID[row.deal.stage].closed;
          deals.push({
            id: uid("deal"),
            title: row.deal.title,
            clientId,
            amount: row.deal.amount,
            stage: row.deal.stage,
            stageReached: STAGE_REACH[row.deal.stage],
            ownerId: row.deal.ownerId,
            priority: row.deal.amount >= 300_000 ? "high" : "medium",
            source: row.client?.source ?? "other",
            leadId: null,
            lostReason: row.deal.stage === "lost" ? "Другое" : null,
            createdAt: created,
            updatedAt: stamp,
            lastActivityAt: stamp,
            expectedCloseAt: iso(Date.now() + 21 * DAY),
            closedAt: closed ? stamp : null,
            stageHistory: [{ stage: row.deal.stage, at: created }],
          });
        }
        if (row.lead) {
          leads.push({
            id: uid("lead"),
            ...row.lead,
            gender: gender(row.lead.name),
            status: "new",
            createdAt: stamp,
            firstResponseAt: null,
            convertedAt: null,
            clientId: null,
            dealId: null,
          });
        }
      }
      const batchRecord: ImportBatch = {
        id: uid("import"),
        fileName,
        at: stamp,
        clientIds: clients.map((c) => c.id),
        dealIds: deals.map((d) => d.id),
        leadIds: leads.map((l) => l.id),
      };
      set((s) => ({
        clients: [...clients, ...s.clients],
        deals: [...deals, ...s.deals],
        leads: [...leads, ...s.leads],
        imports: [batchRecord, ...s.imports].slice(0, 10),
      }));
      return batchRecord;
    },

    undoImport: (batchId) => {
      const record = get().imports.find((b) => b.id === batchId);
      if (!record) return;
      const clientIds = new Set(record.clientIds);
      const dealIds = new Set(record.dealIds);
      const leadIds = new Set(record.leadIds);
      set((s) => ({
        clients: s.clients.filter((c) => !clientIds.has(c.id)),
        deals: s.deals.filter((d) => !dealIds.has(d.id) && !clientIds.has(d.clientId)),
        leads: s.leads.filter((l) => !leadIds.has(l.id)),
        imports: s.imports.filter((b) => b.id !== batchId),
      }));
    },
  };
}
