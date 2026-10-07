import type {
  Activity,
  AppNotification,
  Client,
  CrmData,
  Deal,
  Gender,
  ID,
  Lead,
  LeadSource,
  LeadStatus,
  Member,
  Note,
  Priority,
  Task,
} from "@/types/crm";
import { OPEN_STAGES, SOURCE_BY_ID, STAGES, STAGE_BY_ID } from "@/lib/constants";
import { DAY, HOUR, MINUTE, atTime, iso, startOfDay } from "@/lib/time";
import { clamp } from "@/lib/utils";
import { createRng } from "./random";
import { CITIES, CLIENT_TAGS, COMPANY_PATTERNS, FIRST_NAMES_F, FIRST_NAMES_M, LAST_NAMES, SERVICES, feminine, translit } from "./catalog";
import { DEFAULT_INDUSTRY, packFor } from "@/config/industries";
import { demoAutomations } from "./automations";
import { buildConversations } from "./conversations";
import {
  buildDocuments,
  buildFields,
  buildPlans,
  buildProducts,
  buildTemplates,
  buildViews,
  demoRequisites,
  fillCustomValues,
  fillDealItems,
} from "./extras";

export const DEMO_VERSION = 5;
export const DEMO_SEED = 700;
const HISTORY_DAYS = 760;

interface TeamSeed extends Omit<Member, "joinedAt" | "online"> {
  joinedDaysAgo: number;
  /** доля входящих лидов */
  share: number;
  /** влияет на конверсию */
  skill: number;
}

const TEAM: TeamSeed[] = [
  { id: "m_semen", name: "Семен Морозов", email: "semen@atlas-digital.ru", phone: "+7 916 120-44-10", position: "Основатель", role: "owner", gender: "m", hue: 268, joinedDaysAgo: 900, share: 0, skill: 1 },
  { id: "m_anna", name: "Анна Соколова", email: "anna@atlas-digital.ru", phone: "+7 925 311-08-72", position: "Руководитель отдела продаж", role: "admin", gender: "f", hue: 330, joinedDaysAgo: 820, share: 0.17, skill: 1.14 },
  { id: "m_dmitry", name: "Дмитрий Орлов", email: "dmitry@atlas-digital.ru", phone: "+7 903 455-19-36", position: "Менеджер по продажам", role: "manager", gender: "m", hue: 212, joinedDaysAgo: 760, share: 0.27, skill: 1.04 },
  { id: "m_ekaterina", name: "Екатерина Волкова", email: "ekaterina@atlas-digital.ru", phone: "+7 977 802-64-15", position: "Менеджер по продажам", role: "manager", gender: "f", hue: 160, joinedDaysAgo: 640, share: 0.26, skill: 1.1 },
  { id: "m_maxim", name: "Максим Лебедев", email: "maxim@atlas-digital.ru", phone: "+7 915 640-27-91", position: "Менеджер по продажам", role: "manager", gender: "m", hue: 32, joinedDaysAgo: 420, share: 0.21, skill: 0.84 },
  { id: "m_olga", name: "Ольга Смирнова", email: "olga@atlas-digital.ru", phone: "+7 926 118-90-43", position: "Аккаунт-менеджер", role: "employee", gender: "f", hue: 190, joinedDaysAgo: 300, share: 0.09, skill: 0.93 },
  { id: "m_ilya", name: "Илья Ковалёв", email: "ilya@atlas-digital.ru", phone: "+7 999 270-55-08", position: "Маркетолог", role: "employee", gender: "m", hue: 95, joinedDaysAgo: 210, share: 0, skill: 1 },
];

const SOURCE_WEIGHTS: (readonly [LeadSource, number])[] = [
  ["instagram", 36], ["website", 26], ["telegram", 18], ["whatsapp", 7], ["max", 5], ["vk", 4], ["referral", 3], ["other", 1],
];
const SOURCE_QUALITY: Record<LeadSource, number> = {
  instagram: 0.9, website: 1.12, telegram: 1.05, whatsapp: 1, max: 1, vk: 0.78, referral: 1.55, other: 0.75,
};

export interface GenerateOptions {
  seed?: number;
  now?: number;
  workspaceName?: string;
  /** сфера бизнеса из онбординга: от неё зависят этапы, услуги и тексты */
  industry?: string;
}

export function generateDemoData({ seed = DEMO_SEED, now = Date.now(), workspaceName, industry = DEFAULT_INDUSTRY }: GenerateOptions = {}): CrmData {
  const rng = createRng(seed);
  // отдельный генератор для данных поверх истории продаж — история от него не зависит
  const extra = createRng(seed ^ 0x5f3759df);
  const pack = packFor(industry);
  const name = workspaceName ?? "Атлас Диджитал";
  const serviceSlot = new Map(SERVICES.map((service, index) => [service, index]));
  const dealSlot = new Map<ID, number>();

  const members: Member[] = TEAM.map(({ joinedDaysAgo, share: _share, skill: _skill, ...m }) => ({
    ...m,
    joinedAt: iso(now - joinedDaysAgo * DAY),
    online: ["m_semen", "m_anna", "m_dmitry", "m_ekaterina"].includes(m.id),
  }));
  const skill = Object.fromEntries(TEAM.map((t) => [t.id, t.skill])) as Record<ID, number>;
  const ownerId = "m_semen";

  const clients: Client[] = [];
  const leads: Lead[] = [];
  const deals: Deal[] = [];
  const usedCompanies = new Set<string>();
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}_${(++seq).toString(36).padStart(4, "0")}`;

  const sellersAt = (time: number) =>
    TEAM.filter((t) => t.share > 0 && now - t.joinedDaysAgo * DAY <= time).map((t) => [t.id, t.share] as const);

  const makePerson = () => {
    const gender: Gender = rng.chance(0.52) ? "f" : "m";
    const first = rng.pick(gender === "f" ? FIRST_NAMES_F : FIRST_NAMES_M);
    const last = feminine(rng.pick(LAST_NAMES), gender);
    const soleTrader = rng.chance(0.1);
    const [kind, names] = rng.pick(COMPANY_PATTERNS);
    const brand = rng.pick(names);
    const company = soleTrader ? `ИП ${last} ${first[0]}.` : `${kind} «${brand}»`;
    const domain = soleTrader ? rng.pick(["yandex.ru", "gmail.com", "mail.ru"]) : `${translit(brand)}.ru`;
    const email = `${translit(first)}.${translit(last)}@${domain}`.replace(/-(?=[^@]*@)/g, "");
    const phone = `+7 9${rng.int(0, 9)}${rng.int(0, 9)} ${rng.int(100, 999)}-${String(rng.int(0, 99)).padStart(2, "0")}-${String(rng.int(0, 99)).padStart(2, "0")}`;
    return { name: `${first} ${last}`, gender, company, email, phone, city: rng.weighted(CITIES) };
  };

  /** Название клиента уникально: филиалы получают город, дальше — форма ИП */
  const uniqueCompany = (person: { company: string; city: string; name: string; email: string }) => {
    let { company, email } = person;
    if (usedCompanies.has(company)) company = `${person.company}, ${person.city}`;
    if (usedCompanies.has(company)) {
      const [first, last] = person.name.split(" ");
      company = `ИП ${last} ${first![0]}.`;
      email = `${email.split("@")[0]}@${rng.pick(["yandex.ru", "gmail.com", "mail.ru"])}`;
    }
    usedCompanies.add(company);
    return { company, email };
  };

  const pickPriority = (amount: number): Priority => {
    if (amount >= 300_000) return rng.chance(0.7) ? "high" : "medium";
    if (amount < 80_000) return rng.chance(0.55) ? "low" : "medium";
    return rng.weighted([["medium", 6], ["high", 2], ["low", 2]] as const);
  };

  const createDeal = (lead: Lead, client: Client, createdAt: number, repeat: boolean) => {
    const service = rng.weighted(SERVICES.map((s) => [s, s.weight] as const));
    const slot = serviceSlot.get(service)!;
    const amount = Math.round(rng.float(service.min, service.max) / 500) * 500;
    const cycleDays = clamp(rng.normal(service.cycle * 2.3, service.cycle * 0.6), 6, 120);
    const decisionAt = createdAt + cycleDays * DAY + rng.int(-3, 3) * HOUR;
    const recentBoost = now - createdAt < 75 * DAY ? 1.08 : 1;
    const pWin = clamp(0.5 * recentBoost * (skill[lead.ownerId!] ?? 1) * Math.sqrt(SOURCE_QUALITY[lead.source]) * (repeat ? 1.25 : 1), 0.2, 0.82);
    const willWin = rng.chance(pWin);

    const deal: Deal = {
      id: nextId("deal"),
      title: pack.services[slot] ?? service.title,
      clientId: client.id,
      amount,
      stage: "new",
      stageReached: 0,
      ownerId: lead.ownerId!,
      priority: pickPriority(amount),
      source: lead.source,
      leadId: lead.id,
      lostReason: null,
      createdAt: iso(createdAt),
      updatedAt: iso(createdAt),
      lastActivityAt: iso(createdAt),
      expectedCloseAt: iso(decisionAt),
      closedAt: null,
      stageHistory: [],
    };
    /** Переходы равномерно распределены между созданием и последним движением */
    const spread = (count: number, from: number, to: number) =>
      OPEN_STAGES.slice(0, count).map((stage, k) => ({ stage, at: iso(from + ((to - from) * k) / Math.max(1, count)) }));

    if (decisionAt <= now) {
      deal.stage = willWin ? "won" : "lost";
      deal.stageReached = willWin ? 6 : rng.weighted([[1, 14], [2, 24], [3, 32], [4, 22], [5, 8]] as const);
      deal.lostReason = willWin ? null : rng.weighted(pack.lostReasons.map((r, i) => [r, [5, 4, 3, 3, 2, 1][i]!] as const));
      deal.closedAt = iso(decisionAt);
      deal.updatedAt = deal.closedAt;
      deal.lastActivityAt = deal.closedAt;
      deal.stageHistory = [...spread(Math.min(deal.stageReached, 4) + 1, createdAt, decisionAt), { stage: deal.stage, at: deal.closedAt }];
    } else {
      const progress = (now - createdAt) / (decisionAt - createdAt);
      const index = clamp(Math.floor(progress * 5), 0, 4);
      deal.stage = OPEN_STAGES[index]!;
      deal.stageReached = index;
      const ageDays = (now - createdAt) / DAY;
      const last =
        ageDays > 10 && rng.chance(0.22)
          ? now - rng.int(8, Math.min(18, Math.floor(ageDays) - 1)) * DAY - rng.int(0, 8) * HOUR
          : Math.max(createdAt + 20 * MINUTE, now - rng.int(12, 60 * 52) * MINUTE);
      deal.lastActivityAt = iso(last);
      deal.updatedAt = deal.lastActivityAt;
      deal.stageHistory = spread(index + 1, createdAt, last + (last - createdAt) / Math.max(1, index));
      deal.stageHistory[0]!.at = deal.createdAt;
      if (index >= 3 && rng.chance(0.14)) deal.expectedCloseAt = iso(atTime(now - rng.int(1, 4) * DAY, 18));
    }
    deals.push(deal);
    dealSlot.set(deal.id, slot);
    return deal;
  };

  const createLead = (createdAt: number, forceNew = false) => {
    const repeatPool = clients.length > 15 ? clients.filter((c) => Date.parse(c.createdAt) < createdAt - 45 * DAY) : [];
    const repeat = !forceNew && repeatPool.length > 0 && rng.chance(0.2);
    const existing = repeat ? rng.pick(repeatPool) : null;
    const person = existing
      ? { name: existing.name, gender: existing.gender, company: existing.company, email: existing.email, phone: existing.phone, city: existing.city }
      : makePerson();
    const source: LeadSource = existing
      ? rng.weighted([["telegram", 3], ["whatsapp", 2], ["website", 2], ["referral", 2], ["max", 1]] as const)
      : rng.weighted(SOURCE_WEIGHTS);
    const sellers = sellersAt(createdAt);
    const leadOwner =
      existing && sellers.some(([id]) => id === existing.ownerId) ? existing.ownerId : rng.weighted(sellers);

    const responseMinutes = clamp(Math.round(Math.exp(rng.normal(2.85, 0.75))), 2, 600);
    let firstResponse: number | null = createdAt + responseMinutes * MINUTE;
    const ageDays = (now - createdAt) / DAY;
    const pConvert = clamp(0.4 * SOURCE_QUALITY[source] * Math.sqrt(skill[leadOwner] ?? 1) * (existing ? 1.4 : 1), 0.12, 0.85);
    const roll = rng.next();

    let status: LeadStatus;
    let convert = false;
    if (forceNew || firstResponse > now) {
      status = "new";
      firstResponse = null;
    } else if (ageDays < 1.2) {
      status = roll < 0.3 ? "qualified" : "contacted";
    } else if (ageDays < 14) {
      if (roll < pConvert) convert = true;
      status = convert ? "converted" : roll < pConvert + 0.42 ? (rng.chance(0.55) ? "contacted" : "qualified") : "disqualified";
    } else {
      convert = roll < pConvert;
      status = convert ? "converted" : "disqualified";
    }

    const lead: Lead = {
      id: nextId("lead"),
      name: person.name,
      gender: person.gender,
      company: person.company,
      email: person.email,
      phone: person.phone,
      source,
      status,
      ownerId: leadOwner,
      message: rng.pick(pack.leadMessages),
      budget: rng.chance(0.45) ? Math.round(rng.float(40_000, 400_000) / 10_000) * 10_000 : null,
      createdAt: iso(createdAt),
      firstResponseAt: firstResponse ? iso(firstResponse) : null,
      convertedAt: null,
      clientId: existing?.id ?? null,
      dealId: null,
    };
    leads.push(lead);

    if (convert) {
      const convertedAt = Math.min(createdAt + rng.int(1, 60) * HOUR, now - 30 * MINUTE);
      let client = existing;
      if (!client) {
        const { company, email } = uniqueCompany(person);
        lead.company = company;
        lead.email = email;
        client = {
          id: nextId("client"),
          name: person.name,
          gender: person.gender,
          company,
          email,
          phone: person.phone,
          city: person.city,
          ownerId: leadOwner,
          source,
          tags: [],
          createdAt: iso(convertedAt),
          lastActivityAt: iso(convertedAt),
        };
        if (source === "referral") client.tags.push("Рекомендация");
        if (rng.chance(0.3)) client.tags.push("B2B");
        clients.push(client);
      } else if (!client.tags.includes("Повторный")) {
        client.tags.push("Повторный");
      }
      const deal = createDeal(lead, client, convertedAt, Boolean(existing));
      lead.convertedAt = iso(convertedAt);
      lead.clientId = client.id;
      lead.dealId = deal.id;
    }
  };

  /* ── история лидов и сделок ── */
  for (let d = HISTORY_DAYS; d >= 0; d--) {
    const dayStart = startOfDay(now - d * DAY);
    const progress = 1 - d / HISTORY_DAYS;
    // с августа запущены кампании в Telegram и MAX — поток заявок заметно вырос
    const momentum = d < 42 ? 1.16 : 1;
    const count = rng.poisson((0.95 + 0.8 * progress) * momentum);
    for (let i = 0; i < count; i++) {
      const createdAt = dayStart + rng.int(8 * 60, 21 * 60 + 30) * MINUTE;
      if (createdAt < now - 4 * HOUR) createLead(createdAt);
    }
  }
  // свежие заявки, на которые ещё не ответили — чтобы было что разобрать
  for (const minutesAgo of [185, 95, 52, 14]) createLead(now - minutesAgo * MINUTE, true);

  /* ── частные лица: в B2C-нишах клиенты без компании ── */
  if (pack.b2bSlots !== "all") {
    const b2b = new Set(pack.b2bSlots);
    const personalMail = (email: string) => `${email.split("@")[0]}@${extra.pick(["gmail.com", "yandex.ru", "mail.ru"])}`;
    const firstDeal = new Map<ID, Deal>();
    for (const deal of [...deals].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) if (!firstDeal.has(deal.clientId)) firstDeal.set(deal.clientId, deal);
    const persons = new Set<ID>();
    for (const client of clients) {
      const deal = firstDeal.get(client.id);
      if (deal && b2b.has(dealSlot.get(deal.id) ?? -1)) continue;
      persons.add(client.id);
      client.company = "";
      client.email = personalMail(client.email);
      client.tags = client.tags.filter((t) => t !== "B2B");
    }
    for (const lead of leads) {
      const deal = lead.dealId ? deals.find((d) => d.id === lead.dealId) : undefined;
      const isPerson = lead.clientId ? persons.has(lead.clientId) : !(deal && b2b.has(dealSlot.get(deal.id) ?? -1)) && extra.chance(0.88);
      if (!isPerson) continue;
      const client = lead.clientId ? clients.find((c) => c.id === lead.clientId) : undefined;
      lead.company = "";
      lead.email = client?.email ?? personalMail(lead.email);
    }
  }

  /* ── клиенты: последняя активность ── */
  const clientById = new Map(clients.map((c) => [c.id, c]));
  for (const deal of deals) {
    const client = clientById.get(deal.clientId)!;
    if (deal.lastActivityAt > client.lastActivityAt) client.lastActivityAt = deal.lastActivityAt;
  }
  for (const client of clients) {
    if (client.tags.length === 0 && rng.chance(0.15)) client.tags.push(rng.pick(CLIENT_TAGS));
  }

  /* ── задачи ── */
  const tasks: Task[] = [];
  const openDeals = deals.filter((d) => !STAGE_BY_ID[d.stage].closed);
  const dueAtFor = (bucket: "overdue" | "today" | "upcoming") => {
    if (bucket === "overdue") {
      const due = atTime(now - rng.int(0, 2) * DAY, rng.int(10, 18), rng.pick([0, 30]));
      return due < now - 30 * MINUTE ? due : due - DAY;
    }
    if (bucket === "today") {
      const hour = Math.min(19, Math.max(10, new Date(now).getHours() + 1));
      return atTime(now, rng.int(hour, Math.max(hour, 19)), rng.pick([0, 30]));
    }
    return atTime(now + rng.int(1, 9) * DAY, rng.pick([10, 11, 12, 14, 15, 16]), rng.pick([0, 30]));
  };

  for (const deal of openDeals) {
    const count = deal.stage === "new" ? 1 : rng.chance(0.3) ? 2 : 1;
    const titles = pack.taskTemplates[deal.stage as keyof typeof pack.taskTemplates];
    for (let i = 0; i < count; i++) {
      const bucket = rng.weighted([["overdue", 1], ["today", 3], ["upcoming", 5]] as const);
      const client = clientById.get(deal.clientId)!;
      tasks.push({
        id: nextId("task"),
        title: titles[(i + rng.int(0, titles.length - 1)) % titles.length]!,
        description: `${client.company || client.name}: ${deal.title.charAt(0).toLowerCase()}${deal.title.slice(1)}.`,
        assigneeId: deal.ownerId,
        priority: deal.priority,
        status: "open",
        dueAt: iso(dueAtFor(bucket)),
        completedAt: null,
        dealId: deal.id,
        clientId: client.id,
        leadId: null,
        createdBy: deal.ownerId,
        createdAt: iso(Math.max(Date.parse(deal.createdAt), now - rng.int(1, 6) * DAY)),
      });
    }
  }

  for (const lead of leads.filter((l) => l.status === "new")) {
    tasks.push({
      id: nextId("task"),
      title: `Ответить на заявку ${SOURCE_BY_ID[lead.source].from}`,
      description: lead.message,
      assigneeId: lead.ownerId!,
      priority: "high",
      status: "open",
      dueAt: iso(Date.parse(lead.createdAt) + 15 * MINUTE),
      completedAt: null,
      dealId: null,
      clientId: null,
      leadId: lead.id,
      createdBy: null,
      createdAt: lead.createdAt,
    });
  }

  const negotiationDeal = openDeals.find((d) => d.stage === "negotiation") ?? openDeals[0];
  const ownTasks: [string, string, number, Priority][] = [
    ["Утвердить скидку 10% для клиента", "Анна просит согласовать скидку, чтобы закрыть сделку на этой неделе.", atTime(now, 16), "high"],
    ["Созвон с Анной: план продаж на квартал", "Обсудить цели отдела и бюджет на рекламу.", atTime(now, 17, 30), "medium"],
    ["Проверить отчёт по продажам за неделю", "", atTime(now + 2 * DAY, 11), "low"],
  ];
  ownTasks.forEach(([title, description, due, priority], index) => {
    tasks.push({
      id: nextId("task"),
      title,
      description,
      assigneeId: ownerId,
      priority,
      status: "open",
      dueAt: iso(due),
      completedAt: null,
      dealId: index === 0 && negotiationDeal ? negotiationDeal.id : null,
      clientId: index === 0 && negotiationDeal ? negotiationDeal.clientId : null,
      leadId: null,
      createdBy: "m_anna",
      createdAt: iso(now - (index + 1) * 5 * HOUR),
    });
  });

  const recentDeals = deals.filter((d) => Date.parse(d.lastActivityAt) > now - 30 * DAY);
  for (let i = 0; i < 42 && recentDeals.length; i++) {
    const deal = rng.pick(recentDeals);
    const completedAt = now - rng.int(30, 14 * 24 * 60) * MINUTE;
    tasks.push({
      id: nextId("task"),
      title: rng.pick(pack.doneTasks),
      description: "",
      assigneeId: deal.ownerId,
      priority: deal.priority,
      status: "done",
      dueAt: iso(completedAt + rng.int(-180, 240) * MINUTE),
      completedAt: iso(completedAt),
      dealId: deal.id,
      clientId: deal.clientId,
      leadId: null,
      createdBy: deal.ownerId,
      createdAt: iso(completedAt - rng.int(1, 5) * DAY),
    });
  }

  /* ── заметки ── */
  const notes: Note[] = [];
  for (const deal of deals) {
    const lastActivity = Date.parse(deal.lastActivityAt);
    const isOpen = !STAGE_BY_ID[deal.stage].closed;
    if (!(isOpen ? rng.chance(0.75) : lastActivity > now - 90 * DAY && rng.chance(0.3))) continue;
    const count = isOpen && rng.chance(0.4) ? 2 : 1;
    const from = Date.parse(deal.createdAt);
    for (let i = 0; i < count; i++) {
      notes.push({
        id: nextId("note"),
        body: rng.pick(deal.stageReached >= 3 ? [...pack.notes.early, ...pack.notes.late] : pack.notes.early),
        authorId: deal.ownerId,
        clientId: deal.clientId,
        dealId: deal.id,
        createdAt: iso(from + rng.next() * Math.max(HOUR, Math.min(now, lastActivity) - from)),
      });
    }
  }

  /* ── лента активности ── */
  const activities: Activity[] = [];
  const recent = now - 12 * DAY;
  const push = (a: Omit<Activity, "id">) => activities.push({ id: nextId("act"), ...a });

  for (const lead of leads) {
    if (Date.parse(lead.createdAt) >= recent)
      push({ type: "lead_created", actorId: null, createdAt: lead.createdAt, leadId: lead.id, meta: { name: lead.name, source: lead.source, gender: lead.gender } });
  }
  for (const client of clients) {
    if (Date.parse(client.createdAt) >= recent)
      push({ type: "client_created", actorId: client.ownerId, createdAt: iso(Date.parse(client.createdAt) + 2 * MINUTE), clientId: client.id, meta: { name: client.name, title: client.company || undefined } });
  }
  for (const deal of deals) {
    if (Date.parse(deal.createdAt) >= recent)
      push({ type: "deal_created", actorId: deal.ownerId, createdAt: iso(Date.parse(deal.createdAt) + 4 * MINUTE), dealId: deal.id, clientId: deal.clientId, meta: { title: deal.title, amount: deal.amount } });
    if (deal.closedAt && Date.parse(deal.closedAt) >= recent) {
      push({
        type: deal.stage === "won" ? "deal_won" : "deal_lost",
        actorId: deal.ownerId,
        createdAt: deal.closedAt,
        dealId: deal.id,
        clientId: deal.clientId,
        meta: { title: deal.title, amount: deal.amount, text: deal.lostReason ?? undefined },
      });
    }
    const index = OPEN_STAGES.indexOf(deal.stage as (typeof OPEN_STAGES)[number]);
    if (index >= 1 && Date.parse(deal.lastActivityAt) >= recent) {
      const at = Date.parse(deal.stageHistory[deal.stageHistory.length - 1]!.at);
      if (at >= recent) push({ type: "deal_stage_changed", actorId: deal.ownerId, createdAt: iso(at), dealId: deal.id, clientId: deal.clientId, meta: { title: deal.title, from: OPEN_STAGES[index - 1], to: deal.stage } });
    }
  }
  for (const task of tasks) {
    if (task.completedAt && Date.parse(task.completedAt) >= recent)
      push({ type: "task_completed", actorId: task.assigneeId, createdAt: task.completedAt, taskId: task.id, dealId: task.dealId, clientId: task.clientId, meta: { title: task.title } });
  }
  for (const note of notes) {
    if (Date.parse(note.createdAt) >= recent)
      push({ type: "comment", actorId: note.authorId, createdAt: note.createdAt, clientId: note.clientId, dealId: note.dealId, meta: { text: note.body } });
  }
  activities.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  activities.splice(220);

  /* ── уведомления ── */
  const memberName = (id: ID | null) => members.find((m) => m.id === id)?.name.split(" ")[0] ?? "Система";
  const notifications: AppNotification[] = [];
  const notify = (n: Omit<AppNotification, "id" | "read">) => notifications.push({ id: nextId("ntf"), read: false, ...n });

  leads
    .filter((l) => l.status === "new")
    .slice(-3)
    .forEach((l) =>
      notify({ type: "lead", title: "Новый лид", body: `${l.name}, заявка ${SOURCE_BY_ID[l.source].from}`, href: "/leads", actorId: null, createdAt: l.createdAt }),
    );
  tasks
    .filter((t) => t.status === "open" && Date.parse(t.dueAt) < now && t.assigneeId !== ownerId)
    .slice(0, 2)
    .forEach((t) =>
      notify({ type: "task_overdue", title: "Просрочена задача", body: `${t.title}. Ответственный: ${memberName(t.assigneeId)}`, href: "/tasks", actorId: t.assigneeId, createdAt: t.dueAt }),
    );
  tasks
    .filter((t) => t.assigneeId === ownerId && t.status === "open")
    .slice(0, 2)
    .forEach((t) =>
      notify({ type: "task", title: "Новая задача", body: `Анна назначила вам «${t.title}»`, href: "/tasks", actorId: "m_anna", createdAt: t.createdAt }),
    );
  activities
    .filter((a) => a.type === "deal_stage_changed" || a.type === "deal_won")
    .slice(0, 3)
    .forEach((a) =>
      notify({
        type: "deal",
        title: a.type === "deal_won" ? "Сделка выиграна" : `Сделка перешла в «${pack.stages[a.meta!.to as keyof typeof pack.stages] ?? STAGE_BY_ID[a.meta!.to!].label}»`,
        body: `${a.meta?.title ?? ""}, ${clientById.get(a.clientId!)?.company || clientById.get(a.clientId!)?.name || ""}`,
        href: `/deals?deal=${a.dealId}`,
        actorId: a.actorId,
        createdAt: a.createdAt,
      }),
    );
  activities
    .filter((a) => a.type === "comment")
    .slice(0, 2)
    .forEach((a) =>
      notify({ type: "comment", title: "Новый комментарий", body: `${memberName(a.actorId)}: «${a.meta?.text}»`, href: a.clientId ? `/clients/${a.clientId}` : null, actorId: a.actorId, createdAt: a.createdAt }),
    );
  leads
    .slice(-6, -4)
    .forEach((l) =>
      notify({ type: "automation", title: "Сработала автоматизация", body: `«Новый лид → ответственный и задача»: заявка передана ${memberName(l.ownerId)}`, href: "/automations", actorId: null, createdAt: iso(Date.parse(l.createdAt) + MINUTE) }),
    );
  notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  notifications.forEach((n, index) => (n.read = index >= 5));

  leads.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  deals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  clients.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  tasks.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  /* ── поверх истории: поля, товары, переписка, документы, планы ── */
  const customFields = buildFields(pack);
  fillCustomValues(pack, clients, deals, extra);
  const products = buildProducts(pack);
  fillDealItems(deals, products, now, extra);
  const documents = buildDocuments(deals, now, extra);
  const { conversations, messages } = buildConversations({ leads, deals, clients, members, pack, workspaceName: name, now, rng: extra });

  return {
    version: DEMO_VERSION,
    workspace: {
      id: "ws_atlas",
      name,
      industry: pack.label,
      size: "6–20",
      sources: ["instagram", "website", "telegram", "whatsapp", "max", "referral"],
      plan: "pro",
      currency: "RUB",
      timezone: "Europe/Moscow",
      createdAt: iso(now - 900 * DAY),
      pipeline: STAGES.map((stage) => ({
        id: stage.id,
        label: stage.closed ? stage.label : pack.stages[stage.id as keyof typeof pack.stages],
        probability: stage.probability,
      })),
      requisites: demoRequisites(name, members.find((m) => m.id === ownerId)!.name),
    },
    currentUserId: ownerId,
    members,
    clients,
    leads,
    deals,
    tasks,
    activities,
    notes,
    notifications,
    automations: demoAutomations(now, ownerId),
    conversations,
    messages,
    replyTemplates: buildTemplates(pack),
    customFields,
    products,
    documents,
    plans: buildPlans(members, deals, now),
    views: buildViews(ownerId),
    imports: [],
  };
}
