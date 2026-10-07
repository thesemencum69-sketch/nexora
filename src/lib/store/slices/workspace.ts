/**
 * Настройки CRM: воронка, свои поля, товары, шаблоны ответов, сохранённые виды,
 * планы продаж и реквизиты. Всё меняется на лету, без перезагрузки.
 */
import type {
  CustomField,
  CustomFieldEntity,
  ID,
  Product,
  ReplyTemplate,
  Requisites,
  SalesPlan,
  SavedView,
  StageSetting,
} from "@/types/crm";
import { packFor } from "@/config/industries";
import { STAGES } from "@/lib/constants";
import { applyStageSettings } from "@/lib/stages";
import { uid } from "@/lib/utils";
import type { SliceContext } from "../slice-context";

export interface WorkspaceActions {
  updatePipeline: (pipeline: StageSetting[]) => void;
  /** применяет шаблон сферы: этапы, а по желанию — поля, товары и шаблоны ответов */
  applyIndustryTemplate: (industry: string, include: { fields: boolean; products: boolean; templates: boolean }) => void;

  addCustomField: (input: Omit<CustomField, "id">) => CustomField;
  updateCustomField: (id: ID, patch: Partial<Omit<CustomField, "id" | "entity">>) => void;
  deleteCustomField: (id: ID) => void;
  setCustomValue: (entity: CustomFieldEntity, entityId: ID, fieldId: ID, value: string) => void;

  addProduct: (input: Omit<Product, "id">) => Product;
  updateProduct: (id: ID, patch: Partial<Omit<Product, "id">>) => void;
  deleteProduct: (id: ID) => void;

  addTemplate: (input: Omit<ReplyTemplate, "id">) => ReplyTemplate;
  updateTemplate: (id: ID, patch: Partial<Omit<ReplyTemplate, "id">>) => void;
  deleteTemplate: (id: ID) => void;

  saveView: (view: Omit<SavedView, "id"> & { id?: ID }) => SavedView;
  deleteView: (id: ID) => void;

  setPlans: (month: string, entries: { memberId: ID; amount: number }[]) => void;
  updateRequisites: (patch: Partial<Requisites>) => void;
}

export function createWorkspaceActions({ set, get }: SliceContext): WorkspaceActions {
  return {
    updatePipeline: (pipeline) => {
      applyStageSettings(pipeline);
      set((s) => ({ workspace: { ...s.workspace, pipeline } }));
    },

    applyIndustryTemplate: (industry, include) => {
      const pack = packFor(industry);
      const pipeline: StageSetting[] = STAGES.map((stage) => {
        const current = get().workspace.pipeline.find((p) => p.id === stage.id);
        return stage.closed
          ? (current ?? { id: stage.id, label: stage.label, probability: stage.probability })
          : { id: stage.id, label: pack.stages[stage.id as keyof typeof pack.stages], probability: current?.probability ?? stage.probability };
      });
      applyStageSettings(pipeline);
      set((s) => {
        const fieldLabels = new Set(s.customFields.map((f) => `${f.entity}:${f.label.toLowerCase()}`));
        const productNames = new Set(s.products.map((p) => p.name.toLowerCase()));
        const templateTitles = new Set(s.replyTemplates.map((t) => t.title.toLowerCase()));
        return {
          workspace: { ...s.workspace, industry: pack.label, pipeline },
          customFields: include.fields
            ? [
                ...s.customFields,
                ...pack.fields
                  .filter((f) => !fieldLabels.has(`${f.entity}:${f.label.toLowerCase()}`))
                  .map((f) => ({ id: uid("cf"), entity: f.entity, label: f.label, type: f.type, options: f.options })),
              ]
            : s.customFields,
          products: include.products
            ? [...s.products, ...pack.products.filter((p) => !productNames.has(p.name.toLowerCase())).map((p) => ({ id: uid("prd"), ...p }))]
            : s.products,
          replyTemplates: include.templates
            ? [...s.replyTemplates, ...pack.replyTemplates.filter((t) => !templateTitles.has(t.title.toLowerCase())).map((t) => ({ id: uid("tpl"), ...t }))]
            : s.replyTemplates,
        };
      });
    },

    addCustomField: (input) => {
      const field: CustomField = { id: uid("cf"), ...input, label: input.label.trim() };
      set((s) => ({ customFields: [...s.customFields, field] }));
      return field;
    },
    updateCustomField: (id, patch) => set((s) => ({ customFields: s.customFields.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
    deleteCustomField: (id) =>
      set((s) => {
        const strip = <T extends { custom?: Record<ID, string> }>(item: T): T => {
          if (!item.custom || !(id in item.custom)) return item;
          const { [id]: _removed, ...rest } = item.custom;
          return { ...item, custom: rest };
        };
        return { customFields: s.customFields.filter((f) => f.id !== id), clients: s.clients.map(strip), deals: s.deals.map(strip) };
      }),
    setCustomValue: (entity, entityId, fieldId, value) => {
      const apply = <T extends { id: ID; custom?: Record<ID, string> }>(item: T): T => {
        if (item.id !== entityId) return item;
        const custom = { ...item.custom };
        if (value.trim()) custom[fieldId] = value.trim();
        else delete custom[fieldId];
        return { ...item, custom };
      };
      if (entity === "deal") set((s) => ({ deals: s.deals.map(apply) }));
      else set((s) => ({ clients: s.clients.map(apply) }));
    },

    addProduct: (input) => {
      const product: Product = { id: uid("prd"), ...input };
      set((s) => ({ products: [...s.products, product] }));
      return product;
    },
    updateProduct: (id, patch) => set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
    deleteProduct: (id) => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

    addTemplate: (input) => {
      const template: ReplyTemplate = { id: uid("tpl"), ...input };
      set((s) => ({ replyTemplates: [...s.replyTemplates, template] }));
      return template;
    },
    updateTemplate: (id, patch) => set((s) => ({ replyTemplates: s.replyTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
    deleteTemplate: (id) => set((s) => ({ replyTemplates: s.replyTemplates.filter((t) => t.id !== id) })),

    saveView: (input) => {
      const view: SavedView = { ...input, id: input.id ?? uid("view") };
      set((s) => ({ views: s.views.some((v) => v.id === view.id) ? s.views.map((v) => (v.id === view.id ? view : v)) : [...s.views, view] }));
      return view;
    },
    deleteView: (id) => set((s) => ({ views: s.views.filter((v) => v.id !== id) })),

    setPlans: (month, entries) =>
      set((s) => ({
        plans: [
          ...s.plans.filter((p) => p.month !== month),
          ...entries.filter((e) => e.amount > 0).map<SalesPlan>((e) => ({ month, memberId: e.memberId, amount: Math.round(e.amount) })),
        ],
      })),

    updateRequisites: (patch) => set((s) => ({ workspace: { ...s.workspace, requisites: { ...s.workspace.requisites, ...patch, sample: false } } })),
  };
}
