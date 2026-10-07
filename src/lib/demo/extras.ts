/**
 * Дополнительные демо-данные: свои поля, товары, шаблоны ответов, позиции
 * сделок, документы, планы продаж и сохранённые виды. Используют отдельный
 * генератор случайных чисел, чтобы не менять основную историю продаж.
 */
import type {
  Client,
  CustomField,
  Deal,
  DealDocument,
  DealItem,
  Member,
  Product,
  ReplyTemplate,
  Requisites,
  SalesPlan,
  SavedView,
} from "@/types/crm";
import type { IndustryPack } from "@/config/industries";
import { DAY, HOUR, addMonths, dateKey, iso, monthKey, startOfMonth } from "@/lib/time";
import type { Rng } from "./random";

export const fieldId = (key: string) => `cf_${key}`;

export function buildFields(pack: IndustryPack): CustomField[] {
  return pack.fields.map((f) => ({ id: fieldId(f.key), entity: f.entity, label: f.label, type: f.type, options: f.options }));
}

export function buildProducts(pack: IndustryPack): Product[] {
  return pack.products.map((p, i) => ({ id: `prd_${i + 1}`, ...p }));
}

export function buildTemplates(pack: IndustryPack): ReplyTemplate[] {
  return pack.replyTemplates.map((t, i) => ({ id: `tpl_${i + 1}`, ...t }));
}

/** Заполняет свои поля у части клиентов и сделок — как в живой CRM, где заполнено не всё */
export function fillCustomValues(pack: IndustryPack, clients: Client[], deals: Deal[], rng: Rng) {
  const sampleValue = (field: IndustryPack["fields"][number], ctx: { email?: string; expectedCloseAt?: string }) => {
    if (field.type === "select") return rng.pick(field.options ?? [""]);
    if (field.type === "date") {
      if (field.key === "birthday") return dateKey(new Date(rng.int(1966, 2004), rng.int(0, 11), rng.int(1, 28)));
      const base = ctx.expectedCloseAt ? Date.parse(ctx.expectedCloseAt) : Date.now();
      return dateKey(base + rng.int(5, 21) * DAY);
    }
    const sample = rng.pick(field.samples ?? [""]);
    if (sample === "@domain") {
      const domain = ctx.email?.split("@")[1];
      return domain && !/yandex|gmail|mail\.ru/.test(domain) ? domain : "";
    }
    if (sample === "@inn") return String(rng.int(1000, 9999)) + String(rng.int(100000, 999999));
    return sample;
  };

  for (const client of clients) {
    for (const field of pack.fields.filter((f) => f.entity === "client")) {
      if (!rng.chance(0.72)) continue;
      const value = sampleValue(field, { email: client.email });
      if (value) (client.custom ??= {})[fieldId(field.key)] = value;
    }
  }
  for (const deal of deals) {
    for (const field of pack.fields.filter((f) => f.entity === "deal")) {
      if (!rng.chance(0.66)) continue;
      const value = sampleValue(field, { expectedCloseAt: deal.expectedCloseAt });
      if (value) (deal.custom ??= {})[fieldId(field.key)] = value;
    }
  }
}

/** Позиции сделки: основная услуга и иногда дополнительная из каталога; сумма сходится с суммой сделки */
export function fillDealItems(deals: Deal[], products: Product[], now: number, rng: Rng) {
  let seq = 0;
  for (const deal of deals) {
    const recentWon = deal.stage === "won" && deal.closedAt && now - Date.parse(deal.closedAt) < 60 * DAY;
    const late = deal.stage === "proposal" || deal.stage === "negotiation";
    if (!recentWon && !late) continue;
    const addon = products.filter((p) => p.price > 0 && p.price <= deal.amount * 0.3 && p.price >= deal.amount * 0.04);
    const items: DealItem[] = [];
    if (addon.length && rng.chance(0.4)) {
      const extra = rng.pick(addon);
      items.push({ id: `item_${++seq}`, productId: null, name: deal.title, price: deal.amount - extra.price, qty: 1, unit: "шт." });
      items.push({ id: `item_${++seq}`, productId: extra.id, name: extra.name, price: extra.price, qty: 1, unit: extra.unit });
    } else {
      items.push({ id: `item_${++seq}`, productId: null, name: deal.title, price: deal.amount, qty: 1, unit: "шт." });
    }
    deal.items = items;
  }
}

/** Счета и КП по сделкам, которые до них дошли. Номера сквозные, по дате создания */
export function buildDocuments(deals: Deal[], now: number, rng: Rng): DealDocument[] {
  const docs: Omit<DealDocument, "number">[] = [];
  let seq = 0;
  for (const deal of deals) {
    if (!deal.items?.length) continue;
    const base = { dealId: deal.id, clientId: deal.clientId, items: deal.items, total: deal.amount, createdBy: deal.ownerId };
    const lastChange = Date.parse(deal.stageHistory[deal.stageHistory.length - 1]?.at ?? deal.createdAt);
    if (deal.stage === "won" && deal.closedAt) {
      const paidAt = Date.parse(deal.closedAt);
      docs.push({ id: `doc_${++seq}`, kind: "invoice", status: "paid", createdAt: iso(paidAt - rng.int(6, 96) * HOUR), paidAt: iso(paidAt), ...base });
    } else if (deal.stage === "negotiation" && rng.chance(0.55)) {
      docs.push({ id: `doc_${++seq}`, kind: "invoice", status: "issued", createdAt: iso(Math.min(now - HOUR, lastChange + rng.int(2, 30) * HOUR)), paidAt: null, ...base });
    } else if (deal.stage === "proposal" && rng.chance(0.65)) {
      docs.push({ id: `doc_${++seq}`, kind: "proposal", status: "issued", createdAt: iso(Math.min(now - HOUR, lastChange + rng.int(1, 12) * HOUR)), paidAt: null, ...base });
    }
  }
  docs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const counters = { invoice: 214, proposal: 96 };
  return docs.map((d) => ({ ...d, number: ++counters[d.kind] }));
}

/** Планы на текущий и два прошлых месяца: от средней выручки менеджера с небольшим ростом */
export function buildPlans(members: Member[], deals: Deal[], now: number): SalesPlan[] {
  const sixMonthsAgo = addMonths(startOfMonth(now), -6);
  const sellers = members.filter((m) => m.role !== "owner" && deals.some((d) => d.ownerId === m.id));
  const plans: SalesPlan[] = [];
  for (const member of sellers) {
    const revenue = deals
      .filter((d) => d.ownerId === member.id && d.stage === "won" && d.closedAt && Date.parse(d.closedAt) >= sixMonthsAgo && Date.parse(d.closedAt) < startOfMonth(now))
      .reduce((acc, d) => acc + d.amount, 0);
    const average = revenue / 6;
    if (average < 30_000) continue;
    [1.1, 1.05, 1].forEach((factor, back) => {
      plans.push({ month: monthKey(addMonths(startOfMonth(now), -back)), memberId: member.id, amount: Math.max(100_000, Math.round((average * factor) / 50_000) * 50_000) });
    });
  }
  return plans;
}

export function buildViews(ownerId: string): SavedView[] {
  return [
    { id: "view_hot", entity: "deals", name: "Высокий приоритет", filters: { priority: "high" } },
    { id: "view_vip", entity: "clients", name: "Мои ключевые", filters: { status: "vip", owner: ownerId } },
    { id: "view_tg", entity: "leads", name: "Из Telegram", filters: { source: "telegram" } },
  ];
}

export function demoRequisites(workspaceName: string, ownerName: string): Requisites {
  const [first = "", last = ""] = ownerName.split(" ");
  return {
    legalName: `ООО «${workspaceName.replace(/[«»"]/g, "")}»`,
    inn: "7701234567",
    kpp: "770101001",
    address: "123112, г. Москва, Пресненская наб., д. 12, офис 405",
    bank: "АО «Банк Образец»",
    bik: "044525000",
    account: "40702810900000012345",
    corrAccount: "30101810400000000225",
    director: `${last} ${first.charAt(0)}.`.trim(),
    vat: "none",
    sample: true,
  };
}

export const emptyRequisites = (): Requisites => ({
  legalName: "",
  inn: "",
  kpp: "",
  address: "",
  bank: "",
  bik: "",
  account: "",
  corrAccount: "",
  director: "",
  vat: "none",
  sample: false,
});
