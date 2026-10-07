/**
 * Распознавание колонок и превращение строк таблицы в записи CRM.
 * Названия колонок из amoCRM и Битрикс24 узнаются автоматически.
 */
import type { Client, DealStageId, ID, LeadSource, Member } from "@/types/crm";
import type { ImportRow } from "@/lib/store/slices/bulk";
import { stageList } from "@/lib/stages";
import { digitsOnly } from "@/lib/utils";
import type { ParsedTable } from "./parse";

export type ImportEntity = "clients" | "deals" | "leads";

export type TargetField = "firstName" | "lastName" | "name" | "company" | "phone" | "email" | "city" | "source" | "owner" | "title" | "amount" | "stage" | "comment";

export const TARGETS: { field: TargetField; label: string; entities: ImportEntity[]; synonyms: string[] }[] = [
  { field: "company", label: "Компания", entities: ["clients", "deals", "leads"], synonyms: ["название компании", "компания контакта", "компания", "организация", "company"] },
  { field: "title", label: "Название сделки", entities: ["deals"], synonyms: ["название сделки", "сделка", "deal", "title", "название"] },
  { field: "lastName", label: "Фамилия", entities: ["clients", "deals", "leads"], synonyms: ["фамилия", "last name", "surname"] },
  { field: "firstName", label: "Имя", entities: ["clients", "deals", "leads"], synonyms: ["имя", "first name"] },
  { field: "name", label: "Контакт (ФИО)", entities: ["clients", "deals", "leads"], synonyms: ["основной контакт", "контакт", "фио", "клиент", "full name", "name"] },
  { field: "phone", label: "Телефон", entities: ["clients", "deals", "leads"], synonyms: ["рабочий телефон", "мобильный телефон", "телефон", "phone", "тел"] },
  { field: "email", label: "Email", entities: ["clients", "deals", "leads"], synonyms: ["рабочий email", "e-mail", "email", "почта"] },
  { field: "city", label: "Город", entities: ["clients", "deals"], synonyms: ["город", "city"] },
  { field: "source", label: "Источник", entities: ["clients", "deals", "leads"], synonyms: ["источник", "source", "utm_source", "канал"] },
  { field: "owner", label: "Ответственный", entities: ["clients", "deals", "leads"], synonyms: ["ответственный", "менеджер", "owner"] },
  { field: "amount", label: "Сумма", entities: ["deals", "leads"], synonyms: ["бюджет", "сумма", "amount", "стоимость", "цена"] },
  { field: "stage", label: "Этап", entities: ["deals"], synonyms: ["этап сделки", "стадия сделки", "этап", "стадия", "статус", "stage", "status"] },
  { field: "comment", label: "Комментарий", entities: ["leads", "clients"], synonyms: ["комментарий", "примечание", "сообщение", "comment", "note"] },
];

export type Mapping = Partial<Record<TargetField, number>>;

export function detectSource(headers: string[]) {
  const h = headers.map((x) => x.toLowerCase());
  if (h.some((x) => x.includes("основной контакт")) || (h.some((x) => x.includes("бюджет")) && h.some((x) => x.includes("этап сделки")))) return "amoCRM";
  if (h.some((x) => x.includes("стадия")) || h.some((x) => x === "e-mail рабочий" || x.includes("рабочий e-mail"))) return "Битрикс24";
  return null;
}

export function autoMap(headers: string[]): Mapping {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const taken = new Set<number>();
  const mapping: Mapping = {};
  for (const target of TARGETS) {
    let found = -1;
    for (const synonym of target.synonyms) {
      found = lower.findIndex((h, i) => !taken.has(i) && h === synonym);
      if (found < 0) found = lower.findIndex((h, i) => !taken.has(i) && h.startsWith(synonym));
      if (found < 0 && synonym.length > 3) found = lower.findIndex((h, i) => !taken.has(i) && h.includes(synonym));
      if (found >= 0) break;
    }
    if (found >= 0) {
      mapping[target.field] = found;
      taken.add(found);
    }
  }
  return mapping;
}

export function guessEntity(mapping: Mapping): ImportEntity {
  if (mapping.title !== undefined || mapping.stage !== undefined) return "deals";
  if (mapping.comment !== undefined && mapping.company === undefined) return "leads";
  return "clients";
}

const SOURCE_RULES: [RegExp, LeadSource][] = [
  [/telegram|телеграм|\btg\b/i, "telegram"],
  [/whats ?app|вотсап|ватсап/i, "whatsapp"],
  [/insta|инста/i, "instagram"],
  [/\bvk\b|вконтакте|вк\b/i, "vk"],
  [/\bmax\b|макс/i, "max"],
  [/сайт|site|web|форма|лендинг|landing/i, "website"],
  [/рекоменд|сарафан|referral|знаком/i, "referral"],
];

export const parseSource = (value: string): LeadSource => SOURCE_RULES.find(([re]) => re.test(value))?.[1] ?? "other";

export function parseAmount(value: string) {
  const n = Number(value.replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function parseStage(value: string): DealStageId {
  const v = value.toLowerCase().trim();
  if (!v) return "new";
  const exact = stageList().find((s) => s.label.toLowerCase() === v);
  if (exact) return exact.id;
  if (/успешн|выигр|оплач|сделка заключ|реализовано$/.test(v) && !/не реализ/.test(v)) return "won";
  if (/отказ|провал|проигр|не реализ|закрыто и не/.test(v)) return "lost";
  if (/переговор|договор|согласов/.test(v)) return "negotiation";
  if (/предлож|кп|смет|счёт|счет/.test(v)) return "proposal";
  if (/квалиф|анализ|замер|запис/.test(v)) return "qualification";
  if (/контакт|связал|консультац/.test(v)) return "contact";
  return "new";
}

const first = (value: string) => value.split(/[,;\n]/)[0]!.trim();

export interface PreparedImport {
  rows: ImportRow[];
  created: { clients: number; deals: number; leads: number };
  duplicates: number;
  skipped: number;
}

export function prepareImport({
  table,
  mapping,
  entity,
  clients,
  members,
  fallbackOwner,
}: {
  table: ParsedTable;
  mapping: Mapping;
  entity: ImportEntity;
  clients: Client[];
  members: Member[];
  fallbackOwner: ID;
}): PreparedImport {
  const byPhone = new Map(clients.filter((c) => c.phone).map((c) => [digitsOnly(c.phone).slice(-10), c.id]));
  const byEmail = new Map(clients.filter((c) => c.email).map((c) => [c.email.toLowerCase(), c.id]));
  const seen = new Set<string>();
  const get = (row: string[], field: TargetField) => (mapping[field] === undefined ? "" : (row[mapping[field]!] ?? "").trim());
  const findOwner = (value: string) => {
    const v = value.toLowerCase();
    if (!v) return fallbackOwner;
    return members.find((m) => m.name.toLowerCase() === v || m.name.toLowerCase().split(" ").some((part) => part.length > 2 && v.includes(part)))?.id ?? fallbackOwner;
  };

  const result: PreparedImport = { rows: [], created: { clients: 0, deals: 0, leads: 0 }, duplicates: 0, skipped: 0 };
  for (const row of table.rows) {
    const fullName = get(row, "name") || [get(row, "firstName"), get(row, "lastName")].filter(Boolean).join(" ");
    const company = get(row, "company");
    const name = fullName || company;
    const phone = first(get(row, "phone"));
    const email = first(get(row, "email")).toLowerCase();
    if (!name && !phone && !email) {
      result.skipped++;
      continue;
    }
    const source = parseSource(get(row, "source"));
    const ownerId = findOwner(get(row, "owner"));
    const key = digitsOnly(phone).slice(-10) || email;
    const existing = (digitsOnly(phone).length >= 10 && byPhone.get(digitsOnly(phone).slice(-10))) || (email && byEmail.get(email)) || null;

    if (entity === "leads") {
      result.rows.push({ lead: { name: name || phone || email, company, phone, email, source, ownerId, message: get(row, "comment"), budget: parseAmount(get(row, "amount")) || null } });
      result.created.leads++;
      continue;
    }

    const duplicateInFile = key ? seen.has(key) : false;
    if (key) seen.add(key);
    const client = { name: name || phone || email, company: fullName ? company : "", phone, email, city: get(row, "city"), source, ownerId };

    if (entity === "clients") {
      if (existing || duplicateInFile) {
        result.duplicates++;
        continue;
      }
      result.rows.push({ client });
      result.created.clients++;
      continue;
    }

    const title = get(row, "title") || `Сделка: ${company || name}`;
    const deal = { title, amount: parseAmount(get(row, "amount")), stage: parseStage(get(row, "stage")), ownerId };
    if (existing) {
      result.duplicates++;
      result.rows.push({ existingClientId: existing, deal });
    } else {
      result.rows.push({ client, deal });
      if (!duplicateInFile) result.created.clients++;
    }
    result.created.deals++;
  }
  return result;
}
