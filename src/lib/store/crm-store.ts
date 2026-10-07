/**
 * Демо-хранилище данных CRM (клиентская сторона).
 * Сейчас данные живут в браузере (localStorage), чтобы продукт можно было
 * показать без сервера. Интерфейс действий совпадает с будущими server actions:
 * при подключении backend компоненты не меняются — меняется реализация действий.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toast } from "sonner";
import type {
  Activity,
  AppNotification,
  Automation,
  Client,
  CrmData,
  Deal,
  DealStageId,
  ID,
  Lead,
  LeadSource,
  Member,
  Note,
  Priority,
  Role,
  SalesPlan,
  Task,
  Workspace,
} from "@/types/crm";
import { STAGE_BY_ID, STAGE_REACH } from "@/lib/constants";
import { DEMO_VERSION, generateDemoData } from "@/lib/demo/generate";
import { emptyRequisites } from "@/lib/demo/extras";
import { runAutomations, type AutomationEffects, type AutomationEvent } from "@/lib/automation-engine";
import { applyStageSettings, defaultPipeline } from "@/lib/stages";
import { DAY, addMonths, calendarDaysBetween, iso, monthKey } from "@/lib/time";
import { uid } from "@/lib/utils";
import { createBulkActions, type BulkActions } from "./slices/bulk";
import { createDocumentActions, type DocumentActions } from "./slices/documents";
import { createInboxActions, type InboxActions } from "./slices/inbox";
import { createWorkspaceActions, type WorkspaceActions } from "./slices/workspace";
import type { SliceContext } from "./slice-context";

export interface DealInput {
  title: string;
  clientId: ID;
  amount: number;
  stage: DealStageId;
  ownerId: ID;
  priority: Priority;
  expectedCloseAt: string;
  source?: LeadSource;
}

export interface LeadInput {
  name: string;
  company: string;
  phone: string;
  email: string;
  source: LeadSource;
  ownerId: ID;
  message: string;
  budget: number | null;
}

export interface ClientInput {
  name: string;
  company: string;
  phone: string;
  email: string;
  city: string;
  ownerId: ID;
  source: LeadSource;
}

export interface TaskInput {
  title: string;
  description: string;
  assigneeId: ID;
  dueAt: string;
  priority: Priority;
  dealId: ID | null;
  clientId: ID | null;
  leadId?: ID | null;
}

interface CrmState extends CrmData {
  ready: boolean;
  savedAt: number;
}

interface CrmActions {
  hydrate: () => Promise<void>;
  resetDemo: (options?: { workspaceName?: string; industry?: string }) => void;

  createDeal: (input: DealInput) => Deal;
  updateDeal: (id: ID, patch: Partial<Omit<Deal, "id">>) => void;
  moveDeal: (id: ID, stage: DealStageId, lostReason?: string) => Deal | null;
  deleteDeal: (id: ID) => void;

  createLead: (input: LeadInput) => Lead;
  updateLead: (id: ID, patch: Partial<Omit<Lead, "id">>) => void;
  convertLead: (id: ID) => { client: Client; deal: Deal } | null;
  deleteLead: (id: ID) => void;

  createClient: (input: ClientInput) => Client;
  updateClient: (id: ID, patch: Partial<Omit<Client, "id">>) => void;
  deleteClient: (id: ID) => void;

  createTask: (input: TaskInput) => Task;
  updateTask: (id: ID, patch: Partial<Omit<Task, "id">>) => void;
  toggleTask: (id: ID) => boolean;
  deleteTask: (id: ID) => void;

  addNote: (input: { body: string; clientId: ID | null; dealId: ID | null }) => Note;

  markNotificationRead: (id: ID) => void;
  markAllNotificationsRead: () => void;

  saveAutomation: (automation: Automation) => void;
  toggleAutomation: (id: ID) => void;
  deleteAutomation: (id: ID) => void;

  updateWorkspace: (patch: Partial<Workspace>) => void;
  updateMember: (id: ID, patch: Partial<Omit<Member, "id">>) => void;
  inviteMember: (email: string, role: Exclude<Role, "owner">) => Member;
  removeMember: (id: ID) => void;
}

export type CrmStore = CrmState & CrmActions & InboxActions & WorkspaceActions & DocumentActions & BulkActions;

const EMPTY: CrmData = {
  version: 0,
  workspace: {
    id: "",
    name: "",
    industry: "",
    size: "",
    sources: [],
    plan: "free",
    currency: "RUB",
    timezone: "Europe/Moscow",
    createdAt: new Date(0).toISOString(),
    pipeline: defaultPipeline(),
    requisites: emptyRequisites(),
  },
  currentUserId: "",
  members: [],
  clients: [],
  leads: [],
  deals: [],
  tasks: [],
  activities: [],
  notes: [],
  notifications: [],
  automations: [],
  conversations: [],
  messages: [],
  replyTemplates: [],
  customFields: [],
  products: [],
  documents: [],
  plans: [],
  views: [],
  imports: [],
};

const nowIso = () => new Date().toISOString();

/** Сдвигает все даты (поля *At), чтобы демо не «старело» между визитами */
function shiftDates<T>(items: T[], deltaMs: number): T[] {
  return items.map((item) => {
    const copy = { ...item } as Record<string, unknown>;
    for (const [key, value] of Object.entries(copy)) {
      if (key.endsWith("At") && typeof value === "string") copy[key] = iso(Date.parse(value) + deltaMs);
      if (key === "stageHistory" && Array.isArray(value)) {
        copy[key] = value.map((h: { stage: DealStageId; at: string }) => ({ ...h, at: iso(Date.parse(h.at) + deltaMs) }));
      }
    }
    return copy as T;
  });
}

let hydration: Promise<void> | null = null;

/** Во время массовых действий собираем сработавшие автоматизации и показываем одно уведомление */
let batched: Automation[] | null = null;

function notifyFired(fired: Automation[]) {
  if (batched) {
    batched.push(...fired);
    return;
  }
  for (const automation of fired) {
    toast("Сработала автоматизация", { description: automation.name });
  }
}

function runBatch<T>(run: () => T): T {
  batched = [];
  try {
    return run();
  } finally {
    const fired = batched;
    batched = null;
    if (fired.length) toast(`Сработали автоматизации: ${fired.length}`, { description: [...new Set(fired.map((a) => a.name))].join(", ") });
  }
}

/** Если на текущий месяц план не задан — переносим план прошлого месяца */
function carryPlans(plans: SalesPlan[], now: number): SalesPlan[] {
  const current = monthKey(now);
  if (plans.some((p) => p.month === current)) return plans;
  const previous = monthKey(addMonths(now, -1));
  const carried = plans.filter((p) => p.month === previous).map((p) => ({ ...p, month: current }));
  return carried.length ? [...plans, ...carried] : plans;
}

export const useCrm = create<CrmStore>()(
  persist(
    (set, get) => {
      /** Применяет эффекты автоматизаций к состоянию */
      const applyEffects = (effects: AutomationEffects, event: AutomationEvent) => {
        if (!effects.fired.length) return;
        const firedIds = new Set(effects.fired.map((a) => a.id));
        const stamp = nowIso();
        set((s) => ({
          tasks: [...effects.tasks, ...s.tasks],
          notifications: [...effects.notifications, ...s.notifications],
          automations: s.automations.map((a) => (firedIds.has(a.id) ? { ...a, runs: a.runs + 1, lastRunAt: stamp } : a)),
          deals:
            event.type !== "lead_created" && Object.keys(effects.dealPatch).length
              ? s.deals.map((d) => (d.id === event.deal.id ? { ...d, ...effects.dealPatch } : d))
              : s.deals,
          leads:
            event.type === "lead_created" && Object.keys(effects.leadPatch).length
              ? s.leads.map((l) => (l.id === event.lead.id ? { ...l, ...effects.leadPatch } : l))
              : s.leads,
          activities: [
            ...effects.fired.map<Activity>((a) => ({
              id: uid("act"),
              type: "automation",
              actorId: null,
              createdAt: stamp,
              dealId: event.type === "lead_created" ? null : event.deal.id,
              leadId: event.type === "lead_created" ? event.lead.id : null,
              meta: { title: a.name },
            })),
            ...s.activities,
          ],
        }));
        notifyFired(effects.fired);
      };

      const fire = (event: AutomationEvent) => applyEffects(runAutomations(event, get()), event);

      const log = (activity: Omit<Activity, "id" | "createdAt" | "actorId"> & { actorId?: ID | null }) =>
        set((s) => ({
          activities: [{ id: uid("act"), createdAt: nowIso(), actorId: s.currentUserId, ...activity }, ...s.activities],
        }));

      const touchClient = (clientId: ID | null | undefined) => {
        if (!clientId) return;
        const stamp = nowIso();
        set((s) => ({ clients: s.clients.map((c) => (c.id === clientId ? { ...c, lastActivityAt: stamp } : c)) }));
      };

      const ctx: SliceContext = { set, get, log, touchClient, fire, batch: runBatch };

      const fresh = (options?: { workspaceName?: string; industry?: string }) => {
        const data = generateDemoData({ now: Date.now(), ...options });
        applyStageSettings(data.workspace.pipeline);
        return { ...data, ready: true };
      };

      return {
        ...EMPTY,
        ready: false,
        savedAt: 0,
        ...createInboxActions(ctx),
        ...createWorkspaceActions(ctx),
        ...createDocumentActions(ctx),
        ...createBulkActions(ctx),

        hydrate: () => {
          hydration ??= (async () => {
            await useCrm.persist.rehydrate();
            const s = get();
            const now = Date.now();
            if (!s.deals.length || s.version !== DEMO_VERSION) {
              set(fresh());
              return;
            }
            applyStageSettings(s.workspace.pipeline);
            const days = s.savedAt ? calendarDaysBetween(s.savedAt, now) : 0;
            if (days > 0) {
              const delta = days * DAY;
              set({
                clients: shiftDates(s.clients, delta),
                leads: shiftDates(s.leads, delta),
                deals: shiftDates(s.deals, delta),
                tasks: shiftDates(s.tasks, delta),
                activities: shiftDates(s.activities, delta),
                notes: shiftDates(s.notes, delta),
                notifications: shiftDates(s.notifications, delta),
                automations: shiftDates(s.automations, delta),
                conversations: shiftDates(s.conversations, delta),
                messages: shiftDates(s.messages, delta),
                documents: shiftDates(s.documents, delta),
              });
            }
            set((state) => ({ plans: carryPlans(state.plans, now), ready: true }));
          })();
          return hydration;
        },

        resetDemo: (options) => set(fresh(options)),

        /* ── сделки ── */
        createDeal: (input) => {
          const stamp = nowIso();
          const client = get().clients.find((c) => c.id === input.clientId);
          const closed = STAGE_BY_ID[input.stage].closed;
          const deal: Deal = {
            id: uid("deal"),
            title: input.title,
            clientId: input.clientId,
            amount: input.amount,
            stage: input.stage,
            stageReached: STAGE_REACH[input.stage],
            ownerId: input.ownerId,
            priority: input.priority,
            source: input.source ?? client?.source ?? "other",
            leadId: null,
            lostReason: null,
            createdAt: stamp,
            updatedAt: stamp,
            lastActivityAt: stamp,
            expectedCloseAt: input.expectedCloseAt,
            closedAt: closed ? stamp : null,
            stageHistory: [{ stage: input.stage, at: stamp }],
          };
          set((s) => ({ deals: [deal, ...s.deals] }));
          log({ type: "deal_created", dealId: deal.id, clientId: deal.clientId, meta: { title: deal.title, amount: deal.amount } });
          touchClient(deal.clientId);
          fire({ type: "deal_created", deal });
          return get().deals.find((d) => d.id === deal.id) ?? deal;
        },

        updateDeal: (id, patch) => {
          const stamp = nowIso();
          set((s) => ({ deals: s.deals.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: stamp, lastActivityAt: stamp } : d)) }));
        },

        moveDeal: (id, stage, lostReason) => {
          const current = get().deals.find((d) => d.id === id);
          if (!current || current.stage === stage) return current ?? null;
          const stamp = nowIso();
          const closed = STAGE_BY_ID[stage].closed;
          const next: Deal = {
            ...current,
            stage,
            stageReached: stage === "lost" ? current.stageReached : Math.max(current.stageReached, STAGE_REACH[stage]),
            lostReason: stage === "lost" ? (lostReason ?? "Другое") : null,
            closedAt: closed ? stamp : null,
            updatedAt: stamp,
            lastActivityAt: stamp,
            stageHistory: [...current.stageHistory, { stage, at: stamp }],
          };
          set((s) => ({ deals: s.deals.map((d) => (d.id === id ? next : d)) }));
          log({
            type: stage === "won" ? "deal_won" : stage === "lost" ? "deal_lost" : "deal_stage_changed",
            dealId: id,
            clientId: next.clientId,
            meta: { title: next.title, from: current.stage, to: stage, amount: next.amount, text: next.lostReason ?? undefined },
          });
          touchClient(next.clientId);
          fire({ type: "deal_stage_changed", deal: next, from: current.stage });
          if (stage === "won") fire({ type: "deal_won", deal: next });
          return get().deals.find((d) => d.id === id) ?? next;
        },

        deleteDeal: (id) =>
          set((s) => ({
            deals: s.deals.filter((d) => d.id !== id),
            tasks: s.tasks.map((t) => (t.dealId === id ? { ...t, dealId: null } : t)),
            notes: s.notes.map((n) => (n.dealId === id ? { ...n, dealId: null } : n)),
            documents: s.documents.filter((d) => d.dealId !== id),
            conversations: s.conversations.map((c) => (c.dealId === id ? { ...c, dealId: null } : c)),
          })),

        /* ── лиды ── */
        createLead: (input) => {
          const lead: Lead = {
            id: uid("lead"),
            ...input,
            gender: /а$|я$/.test(input.name.trim().split(/\s+/)[0] ?? "") ? "f" : "m",
            status: "new",
            createdAt: nowIso(),
            firstResponseAt: null,
            convertedAt: null,
            clientId: null,
            dealId: null,
          };
          set((s) => ({ leads: [lead, ...s.leads] }));
          log({ type: "lead_created", actorId: null, leadId: lead.id, meta: { name: lead.name, source: lead.source, gender: lead.gender } });
          fire({ type: "lead_created", lead });
          return get().leads.find((l) => l.id === lead.id) ?? lead;
        },

        updateLead: (id, patch) =>
          set((s) => ({
            leads: s.leads.map((l) => {
              if (l.id !== id) return l;
              const next = { ...l, ...patch };
              if (patch.status && patch.status !== "new" && !l.firstResponseAt) next.firstResponseAt = nowIso();
              return next;
            }),
          })),

        convertLead: (id) => {
          const lead = get().leads.find((l) => l.id === id);
          if (!lead || lead.dealId) return null;
          const owner = lead.ownerId ?? get().currentUserId;
          const existing =
            (lead.clientId && get().clients.find((c) => c.id === lead.clientId)) ||
            get().clients.find((c) => (lead.email && c.email === lead.email) || (lead.phone && c.phone === lead.phone));
          const client =
            existing ??
            get().createClient({
              name: lead.name,
              company: lead.company,
              phone: lead.phone,
              email: lead.email,
              city: "",
              ownerId: owner,
              source: lead.source,
            });
          const deal = get().createDeal({
            title: lead.company ? `Сделка с ${lead.company}` : `Сделка: ${lead.name}`,
            clientId: client.id,
            amount: lead.budget ?? 0,
            stage: "qualification",
            ownerId: owner,
            priority: "medium",
            expectedCloseAt: iso(Date.now() + 21 * DAY),
            source: lead.source,
          });
          const stamp = nowIso();
          set((s) => ({
            deals: s.deals.map((d) => (d.id === deal.id ? { ...d, leadId: lead.id } : d)),
            leads: s.leads.map((l) =>
              l.id === id
                ? { ...l, status: "converted", clientId: client.id, dealId: deal.id, convertedAt: stamp, firstResponseAt: l.firstResponseAt ?? stamp }
                : l,
            ),
            conversations: s.conversations.map((c) => (c.leadId === id ? { ...c, clientId: client.id, dealId: deal.id } : c)),
          }));
          return { client, deal };
        },

        deleteLead: (id) => set((s) => ({ leads: s.leads.filter((l) => l.id !== id) })),

        /* ── клиенты ── */
        createClient: (input) => {
          const stamp = nowIso();
          const client: Client = {
            id: uid("client"),
            ...input,
            gender: /а$|я$/.test(input.name.trim().split(/\s+/)[0] ?? "") ? "f" : "m",
            tags: [],
            createdAt: stamp,
            lastActivityAt: stamp,
          };
          set((s) => ({ clients: [client, ...s.clients] }));
          log({ type: "client_created", clientId: client.id, meta: { name: client.name, title: client.company || undefined } });
          return client;
        },

        updateClient: (id, patch) => set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

        deleteClient: (id) =>
          set((s) => {
            const dealIds = new Set(s.deals.filter((d) => d.clientId === id).map((d) => d.id));
            return {
              clients: s.clients.filter((c) => c.id !== id),
              deals: s.deals.filter((d) => d.clientId !== id),
              tasks: s.tasks.filter((t) => t.clientId !== id && !(t.dealId && dealIds.has(t.dealId))),
              notes: s.notes.filter((n) => n.clientId !== id),
              documents: s.documents.filter((d) => d.clientId !== id),
              conversations: s.conversations.map((c) => (c.clientId === id ? { ...c, clientId: null, dealId: null } : c)),
            };
          }),

        /* ── задачи ── */
        createTask: (input) => {
          const task: Task = {
            id: uid("task"),
            ...input,
            leadId: input.leadId ?? null,
            status: "open",
            completedAt: null,
            createdBy: get().currentUserId,
            createdAt: nowIso(),
          };
          set((s) => ({ tasks: [task, ...s.tasks] }));
          if (task.assigneeId !== get().currentUserId) {
            const me = get().members.find((m) => m.id === get().currentUserId);
            const notification: AppNotification = {
              id: uid("ntf"),
              type: "task",
              title: "Задача назначена",
              body: `${me?.name.split(" ")[0] ?? "Вы"} → ${get().members.find((m) => m.id === task.assigneeId)?.name ?? ""}: «${task.title}»`,
              href: "/tasks",
              actorId: get().currentUserId,
              read: true,
              createdAt: task.createdAt,
            };
            set((s) => ({ notifications: [notification, ...s.notifications] }));
          }
          return task;
        },

        updateTask: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

        toggleTask: (id) => {
          const task = get().tasks.find((t) => t.id === id);
          if (!task) return false;
          const done = task.status !== "done";
          const stamp = nowIso();
          set((s) => ({
            tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: done ? "done" : "open", completedAt: done ? stamp : null } : t)),
          }));
          if (done) {
            log({ type: "task_completed", taskId: id, dealId: task.dealId, clientId: task.clientId, meta: { title: task.title } });
            touchClient(task.clientId);
            if (task.dealId) set((s) => ({ deals: s.deals.map((d) => (d.id === task.dealId ? { ...d, lastActivityAt: stamp } : d)) }));
          }
          return done;
        },

        deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

        /* ── заметки ── */
        addNote: ({ body, clientId, dealId }) => {
          const note: Note = { id: uid("note"), body, authorId: get().currentUserId, clientId, dealId, createdAt: nowIso() };
          set((s) => ({ notes: [note, ...s.notes] }));
          log({ type: "comment", clientId, dealId, meta: { text: body } });
          touchClient(clientId);
          return note;
        },

        /* ── уведомления ── */
        markNotificationRead: (id) =>
          set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
        markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

        /* ── автоматизации ── */
        saveAutomation: (automation) =>
          set((s) => ({
            automations: s.automations.some((a) => a.id === automation.id)
              ? s.automations.map((a) => (a.id === automation.id ? automation : a))
              : [automation, ...s.automations],
          })),
        toggleAutomation: (id) =>
          set((s) => ({ automations: s.automations.map((a) => (a.id === id ? { ...a, active: !a.active } : a)) })),
        deleteAutomation: (id) => set((s) => ({ automations: s.automations.filter((a) => a.id !== id) })),

        /* ── компания и команда ── */
        updateWorkspace: (patch) => set((s) => ({ workspace: { ...s.workspace, ...patch } })),
        updateMember: (id, patch) => set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
        inviteMember: (email, role) => {
          const local = email.split("@")[0] ?? "Коллега";
          const member: Member = {
            id: uid("m"),
            name: local.charAt(0).toUpperCase() + local.slice(1),
            email,
            phone: "",
            position: "Приглашение отправлено",
            role,
            gender: "m",
            hue: Math.floor(Math.random() * 360),
            online: false,
            joinedAt: nowIso(),
          };
          set((s) => ({ members: [...s.members, member] }));
          return member;
        },
        removeMember: (id) =>
          set((s) => {
            const fallback = s.currentUserId;
            return {
              members: s.members.filter((m) => m.id !== id),
              deals: s.deals.map((d) => (d.ownerId === id ? { ...d, ownerId: fallback } : d)),
              tasks: s.tasks.map((t) => (t.assigneeId === id ? { ...t, assigneeId: fallback } : t)),
              leads: s.leads.map((l) => (l.ownerId === id ? { ...l, ownerId: fallback } : l)),
              clients: s.clients.map((c) => (c.ownerId === id ? { ...c, ownerId: fallback } : c)),
              conversations: s.conversations.map((c) => (c.ownerId === id ? { ...c, ownerId: fallback } : c)),
              plans: s.plans.filter((p) => p.memberId !== id),
            };
          }),
      };
    },
    {
      name: "nexora-demo",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s): CrmData & { savedAt: number } => ({
        version: s.version,
        workspace: s.workspace,
        currentUserId: s.currentUserId,
        members: s.members,
        clients: s.clients,
        leads: s.leads,
        deals: s.deals,
        tasks: s.tasks,
        activities: s.activities.slice(0, 400),
        notes: s.notes,
        notifications: s.notifications.slice(0, 100),
        automations: s.automations,
        conversations: s.conversations,
        messages: s.messages,
        replyTemplates: s.replyTemplates,
        customFields: s.customFields,
        products: s.products,
        documents: s.documents,
        plans: s.plans,
        views: s.views,
        imports: s.imports,
        savedAt: Date.now(),
      }),
    },
  ),
);
