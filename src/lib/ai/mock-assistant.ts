/**
 * AI-ассистент в демо-режиме: отвечает правилами по реальным данным CRM.
 * Интерфейс ответа (блоки) не зависит от источника — позже здесь будет вызов
 * языковой модели с теми же данными в контексте.
 */
import type { Client, Deal, ID, Lead, Member, Task } from "@/types/crm";
import { LEAD_RESPONSE_SLA_MIN, SOURCES, SOURCE_BY_ID, STALE_DEAL_DAYS } from "@/lib/constants";
import { stageLabel } from "@/lib/stages";
import { formatDuration, formatMoney, formatMoneyCompact, formatPercent, formatPoints, formatRelative } from "@/lib/format";
import {
  averageResponse,
  clientStatsMap,
  forecast,
  getPeriodWindow,
  isOpen,
  leadsBetween,
  statsFor,
  teamPerformance,
  wonBetween,
} from "@/lib/metrics";
import { DAY, MINUTE } from "@/lib/time";
import { normalize, plural } from "@/lib/utils";

export interface AiListItem {
  title: string;
  subtitle?: string;
  badge?: string;
  tone?: "critical" | "warning" | "default";
  dealId?: ID;
  href?: string;
}

export type AiBlock =
  | { type: "text"; text: string }
  | { type: "metrics"; items: { label: string; value: string; delta?: string; good?: boolean }[] }
  | { type: "list"; title?: string; items: AiListItem[] }
  | { type: "action"; id: "tasks_for_leads" | "tasks_for_deals"; label: string; payload: ID[] };

export interface AiAnswer {
  blocks: AiBlock[];
  followUps: string[];
}

export interface AiContext {
  deals: Deal[];
  leads: Lead[];
  tasks: Task[];
  clients: Client[];
  members: Member[];
  now: number;
}

export const SUGGESTIONS = [
  "Найди потерянные лиды",
  "Почему изменилась конверсия?",
  "Какие сделки под риском?",
  "Проанализируй работу менеджеров",
  "Что сделать сегодня в первую очередь?",
  "Как идут продажи и какой прогноз?",
];

const firstName = (members: Member[], id: ID | null) => members.find((m) => m.id === id)?.name.split(" ")[0] ?? "без ответственного";

function lostLeads(ctx: AiContext): AiAnswer {
  const unanswered = ctx.leads
    .filter((l) => l.status === "new" && !l.firstResponseAt && ctx.now - Date.parse(l.createdAt) > LEAD_RESPONSE_SLA_MIN * MINUTE)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const stuck = ctx.leads
    .filter((l) => (l.status === "contacted" || l.status === "qualified") && ctx.now - Date.parse(l.createdAt) > 3 * DAY && !l.dealId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, 8);
  const all = [...unanswered, ...stuck];
  if (!all.length) {
    return {
      blocks: [{ type: "text", text: "Потерянных лидов не вижу: на все заявки ответили вовремя, а лиды в работе двигаются. Отличная дисциплина команды." }],
      followUps: ["Какие сделки под риском?", "Что сделать сегодня в первую очередь?"],
    };
  }
  return {
    blocks: [
      {
        type: "text",
        text: `Нашёл ${all.length} ${plural(all.length, ["лид", "лида", "лидов"])}, которые могут уйти к конкурентам. ${unanswered.length ? `${unanswered.length} ждут первого ответа дольше ${LEAD_RESPONSE_SLA_MIN} минут — по статистике шанс на сделку падает в разы уже через час. ` : ""}${stuck.length ? `Ещё ${stuck.length} в работе больше трёх дней, но сделка так и не создана.` : ""}`,
      },
      {
        type: "list",
        items: all.map((l) => ({
          title: `${l.name}${l.company ? `, ${l.company}` : ""}`,
          subtitle: `Заявка ${SOURCE_BY_ID[l.source].from}, ${formatRelative(l.createdAt, ctx.now)}. Ответственный: ${firstName(ctx.members, l.ownerId)}`,
          badge: l.status === "new" ? "без ответа" : "нет сделки",
          tone: l.status === "new" ? ("critical" as const) : ("warning" as const),
          href: `/leads?q=${encodeURIComponent(l.name)}`,
        })),
      },
      { type: "action", id: "tasks_for_leads", label: `Поставить задачи на связь: ${all.length}`, payload: all.map((l) => l.id) },
    ],
    followUps: ["Какой канал приносит лучших клиентов?", "Проанализируй работу менеджеров"],
  };
}

function conversion(ctx: AiContext): AiAnswer {
  const w = getPeriodWindow("30d", ctx.now);
  const cur = leadsBetween(ctx.leads, w.start, w.end);
  const prev = leadsBetween(ctx.leads, w.prevStart, w.prevEnd);
  const wonCur = wonBetween(ctx.deals, w.start, w.end);
  const wonPrev = wonBetween(ctx.deals, w.prevStart, w.prevEnd);
  const rate = cur.length ? wonCur.length / cur.length : 0;
  const prevRate = prev.length ? wonPrev.length / prev.length : 0;
  const respCur = averageResponse(cur);
  const respPrev = averageResponse(prev);

  const bySource = SOURCES.map((s) => {
    const lc = cur.filter((l) => l.source === s.id).length;
    const lp = prev.filter((l) => l.source === s.id).length;
    const wc = wonCur.filter((d) => d.source === s.id).length;
    const wp = wonPrev.filter((d) => d.source === s.id).length;
    return { source: s.id, lc, lp, conv: lc ? wc / lc : 0, prevConv: lp ? wp / lp : 0, share: cur.length ? lc / cur.length : 0, prevShare: prev.length ? lp / prev.length : 0 };
  }).filter((r) => r.lc + r.lp > 0);
  const growing = [...bySource].sort((a, b) => b.share - b.prevShare - (a.share - a.prevShare))[0];
  const best = [...bySource].filter((r) => r.lc >= 3).sort((a, b) => b.conv - a.conv)[0];

  const direction = rate < prevRate ? "снизилась" : rate > prevRate ? "выросла" : "не изменилась";
  const reasons: string[] = [];
  if (cur.length > prev.length * 1.15)
    reasons.push(`лидов стало на ${formatPercent((cur.length - prev.length) / Math.max(1, prev.length))} больше — команда успевает обработать не всех с прежним качеством`);
  if (growing && growing.share - growing.prevShare > 0.04)
    reasons.push(`выросла доля заявок ${SOURCE_BY_ID[growing.source].from} (${formatPercent(growing.prevShare)} → ${formatPercent(growing.share)}), а они конвертируются ${growing.conv < rate ? "хуже среднего" : "не хуже среднего"}`);
  if (respCur !== null && respPrev !== null && respCur > respPrev * 1.1)
    reasons.push(`среднее время первого ответа выросло с ${formatDuration(respPrev)} до ${formatDuration(respCur)}`);
  if (!reasons.length) reasons.push("заметных сдвигов в каналах и скорости ответа нет — колебание в пределах обычного");

  return {
    blocks: [
      {
        type: "text",
        text: `За последние 30 дней конверсия из лида в оплату ${direction}: ${formatPercent(rate)} против ${formatPercent(prevRate)} месяцем раньше. Что повлияло: ${reasons.join("; ")}.`,
      },
      {
        type: "metrics",
        items: [
          { label: "Конверсия", value: formatPercent(rate), delta: formatPoints(rate - prevRate), good: rate >= prevRate },
          { label: "Новые лиды", value: String(cur.length), delta: prev.length ? `${cur.length >= prev.length ? "+" : ""}${cur.length - prev.length}` : undefined, good: cur.length >= prev.length },
          { label: "Ответ лиду", value: respCur !== null ? formatDuration(respCur) : "—", delta: respPrev !== null ? `было ${formatDuration(respPrev)}` : undefined, good: respCur !== null && respPrev !== null ? respCur <= respPrev : true },
        ],
      },
      {
        type: "list",
        title: "Конверсия по каналам за 30 дней",
        items: bySource
          .sort((a, b) => b.lc - a.lc)
          .map((r) => ({
            title: SOURCE_BY_ID[r.source].label,
            subtitle: `${r.lc} ${plural(r.lc, ["лид", "лида", "лидов"])}, доля ${formatPercent(r.share)}`,
            badge: formatPercent(r.conv),
            tone: r.conv < r.prevConv - 0.03 ? ("warning" as const) : ("default" as const),
          })),
      },
      {
        type: "text",
        text: best
          ? `Что сделать: держать ответ лиду в пределах ${LEAD_RESPONSE_SLA_MIN} минут (автоматизация «Новый лид → ответственный и задача» уже настроена), а бюджет масштабировать в канал «${SOURCE_BY_ID[best.source].label}» — там конверсия ${formatPercent(best.conv)}.`
          : `Что сделать: держать ответ лиду в пределах ${LEAD_RESPONSE_SLA_MIN} минут и следить за каналами, которые растут быстрее остальных.`,
      },
    ],
    followUps: ["Найди потерянные лиды", "Проанализируй работу менеджеров"],
  };
}

function atRisk(ctx: AiContext): AiAnswer {
  const openTasksByDeal = new Set(ctx.tasks.filter((t) => t.status === "open" && t.dealId).map((t) => t.dealId));
  const risky = ctx.deals
    .filter(isOpen)
    .map((d) => {
      const reasons: string[] = [];
      const idle = Math.floor((ctx.now - Date.parse(d.lastActivityAt)) / DAY);
      if (idle >= STALE_DEAL_DAYS) reasons.push(`${idle} дн. без движения`);
      if (Date.parse(d.expectedCloseAt) < ctx.now) reasons.push("прошёл срок закрытия");
      if (!openTasksByDeal.has(d.id)) reasons.push("нет следующего шага");
      return { deal: d, reasons };
    })
    .filter((r) => r.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length || b.deal.amount - a.deal.amount)
    .slice(0, 8);
  const sum = risky.reduce((acc, r) => acc + r.deal.amount, 0);
  if (!risky.length) {
    return {
      blocks: [{ type: "text", text: "Под риском сделок нет: у всех есть следующий шаг, сроки не сорваны, движение было на этой неделе." }],
      followUps: ["Как идут продажи и какой прогноз?"],
    };
  }
  const clientName = (id: ID) => ctx.clients.find((c) => c.id === id)?.company ?? "";
  return {
    blocks: [
      {
        type: "text",
        text: `Под риском ${risky.length} ${plural(risky.length, ["сделка", "сделки", "сделок"])} на ${formatMoney(sum)}. Чаще всего причина одна — у сделки нет запланированного следующего шага: менеджер ждёт ответа клиента, а клиент остывает.`,
      },
      {
        type: "list",
        items: risky.map((r) => ({
          title: `${r.deal.title}, ${formatMoney(r.deal.amount)}`,
          subtitle: `${clientName(r.deal.clientId)}. Этап «${stageLabel(r.deal.stage)}», ${firstName(ctx.members, r.deal.ownerId)}`,
          badge: r.reasons[0],
          tone: r.reasons.length > 1 ? ("critical" as const) : ("warning" as const),
          dealId: r.deal.id,
        })),
      },
      { type: "action", id: "tasks_for_deals", label: `Поставить задачи по сделкам: ${risky.length}`, payload: risky.map((r) => r.deal.id) },
    ],
    followUps: ["Что сделать сегодня в первую очередь?", "Проанализируй работу менеджеров"],
  };
}

function managers(ctx: AiContext): AiAnswer {
  const rows = teamPerformance(ctx.members, ctx, "3m", ctx.now).filter((r) => r.won + r.lost > 0 || r.leads > 0);
  if (!rows.length) return { blocks: [{ type: "text", text: "Пока недостаточно данных по команде." }], followUps: [] };
  const team = rows.reduce((acc, r) => ({ won: acc.won + r.won, lost: acc.lost + r.lost }), { won: 0, lost: 0 });
  const teamRate = team.won + team.lost ? team.won / (team.won + team.lost) : 0;
  const leader = rows[0]!;
  const slowest = [...rows].filter((r) => r.avgResponseMin !== null).sort((a, b) => b.avgResponseMin! - a.avgResponseMin!)[0];
  const weakest = [...rows].filter((r) => r.won + r.lost >= 4).sort((a, b) => a.winRate - b.winRate)[0];
  const insights = [
    `Лидер по выручке за 3 месяца — ${leader.member.name}: ${formatMoney(leader.revenue)}, доля выигранных ${formatPercent(leader.winRate)}.`,
  ];
  if (weakest && weakest.member.id !== leader.member.id && weakest.winRate < teamRate - 0.05)
    insights.push(`${weakest.member.name.split(" ")[0]} выигрывает ${formatPercent(weakest.winRate)} сделок при среднем по команде ${formatPercent(teamRate)} — стоит разобрать с ним проигранные сделки и причины отказов.`);
  if (slowest && slowest.avgResponseMin! > LEAD_RESPONSE_SLA_MIN)
    insights.push(`Медленнее всех отвечает на заявки ${slowest.member.name.split(" ")[0]} — в среднем ${formatDuration(slowest.avgResponseMin!)}.`);
  return {
    blocks: [
      { type: "text", text: insights.join(" ") },
      {
        type: "list",
        title: "Команда за 3 месяца",
        items: rows.map((r) => ({
          title: r.member.name,
          subtitle: `${r.won} ${plural(r.won, ["сделка", "сделки", "сделок"])}, ответ лиду ${r.avgResponseMin !== null ? formatDuration(r.avgResponseMin) : "—"}, в работе ${formatMoneyCompact(r.pipeline)}`,
          badge: formatMoneyCompact(r.revenue),
        })),
      },
    ],
    followUps: ["Какие сделки под риском?", "Почему изменилась конверсия?"],
  };
}

function sales(ctx: AiContext): AiAnswer {
  const w = getPeriodWindow("30d", ctx.now);
  const won = wonBetween(ctx.deals, w.start, w.end);
  const prev = wonBetween(ctx.deals, w.prevStart, w.prevEnd);
  const revenue = won.reduce((a, d) => a + d.amount, 0);
  const prevRevenue = prev.reduce((a, d) => a + d.amount, 0);
  const delta = prevRevenue ? (revenue - prevRevenue) / prevRevenue : 0;
  const weighted = forecast(ctx.deals);
  const pipeline = ctx.deals.filter(isOpen).reduce((a, d) => a + d.amount, 0);
  const bySource = SOURCES.map((s) => ({ s, sum: won.filter((d) => d.source === s.id).reduce((a, d) => a + d.amount, 0) }))
    .filter((r) => r.sum > 0)
    .sort((a, b) => b.sum - a.sum);
  return {
    blocks: [
      {
        type: "text",
        text: `За 30 дней выручка ${formatMoney(revenue)} — ${delta >= 0 ? "на" : "на"} ${formatPercent(Math.abs(delta))} ${delta >= 0 ? "больше" : "меньше"}, чем месяцем раньше. В работе сделок на ${formatMoney(pipeline)}; с учётом вероятности этапов прогноз ближайших поступлений ≈ ${formatMoney(weighted)}.`,
      },
      {
        type: "metrics",
        items: [
          { label: "Выручка", value: formatMoneyCompact(revenue), delta: `${delta >= 0 ? "+" : "−"}${formatPercent(Math.abs(delta))}`, good: delta >= 0 },
          { label: "Сделок", value: String(won.length), delta: `было ${prev.length}`, good: won.length >= prev.length },
          { label: "Прогноз", value: formatMoneyCompact(weighted) },
        ],
      },
      {
        type: "list",
        title: "Откуда пришли деньги",
        items: bySource.slice(0, 5).map((r) => ({ title: r.s.label, badge: formatMoneyCompact(r.sum), subtitle: `${formatPercent(r.sum / (revenue || 1))} выручки` })),
      },
    ],
    followUps: ["Какие сделки под риском?", "Почему изменилась конверсия?"],
  };
}

function todayPlan(ctx: AiContext): AiAnswer {
  const items: AiListItem[] = [];
  const unanswered = ctx.leads.filter((l) => l.status === "new" && !l.firstResponseAt);
  if (unanswered.length)
    items.push({ title: `Ответить на ${unanswered.length} ${plural(unanswered.length, ["новую заявку", "новые заявки", "новых заявок"])}`, subtitle: "Каждая минута ожидания снижает шанс на сделку", tone: "critical", href: "/leads?status=new" });
  const overdue = ctx.tasks.filter((t) => t.status === "open" && Date.parse(t.dueAt) < ctx.now);
  if (overdue.length) items.push({ title: `Закрыть ${overdue.length} ${plural(overdue.length, ["просроченную задачу", "просроченные задачи", "просроченных задач"])}`, subtitle: `Самая старая: «${overdue.sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]!.title}»`, tone: "warning", href: "/tasks?tab=overdue" });
  const closing = ctx.deals.filter((d) => d.stage === "negotiation").sort((a, b) => b.amount - a.amount).slice(0, 2);
  for (const d of closing) items.push({ title: `Дожать «${d.title}» на ${formatMoney(d.amount)}`, subtitle: "Сделка на переговорах — один звонок может решить исход", dealId: d.id });
  const stats = clientStatsMap(ctx.deals);
  const sleeping = ctx.clients
    .filter((c) => statsFor(stats, c.id).revenue > 300_000 && ctx.now - Date.parse(c.lastActivityAt) > 120 * DAY)
    .sort((a, b) => statsFor(stats, b.id).revenue - statsFor(stats, a.id).revenue)[0];
  if (sleeping) items.push({ title: `Напомнить о себе: ${sleeping.company}`, subtitle: `Клиент принёс ${formatMoney(statsFor(stats, sleeping.id).revenue)}, последний контакт ${formatRelative(sleeping.lastActivityAt, ctx.now)}`, href: `/clients/${sleeping.id}` });
  return {
    blocks: [
      { type: "text", text: items.length ? "Вот что даст больше всего денег сегодня — в порядке важности:" : "Срочного нет. Хороший день, чтобы спланировать неделю и навести порядок в воронке." },
      ...(items.length ? [{ type: "list" as const, items }] : []),
    ],
    followUps: ["Найди потерянные лиды", "Какие сделки под риском?"],
  };
}

function clientSummary(ctx: AiContext, question: string): AiAnswer | null {
  const q = normalize(question);
  const client = ctx.clients.find((c) => {
    const brand = normalize(c.company).match(/«(.+?)»/)?.[1];
    return (brand && q.includes(brand)) || q.includes(normalize(c.name));
  });
  if (!client) return null;
  const stats = statsFor(clientStatsMap(ctx.deals), client.id);
  const open = ctx.deals.filter((d) => d.clientId === client.id && isOpen(d));
  return {
    blocks: [
      {
        type: "text",
        text: `${client.company ? `${client.company}, контакт — ${client.name}` : client.name}. Клиент с ${formatRelative(client.createdAt, ctx.now)}: ${stats.deals} ${plural(stats.deals, ["сделка", "сделки", "сделок"])}, выручка ${formatMoney(stats.revenue)}. Последний контакт ${formatRelative(client.lastActivityAt, ctx.now)}. ${open.length ? `В работе: ${open.map((d) => `«${d.title}» (${stageLabel(d.stage).toLowerCase()})`).join(", ")}.` : "Открытых сделок нет — можно предложить следующий проект."}`,
      },
    ],
    followUps: ["Что сделать сегодня в первую очередь?"],
  };
}

function overview(ctx: AiContext): AiAnswer {
  return {
    blocks: [
      {
        type: "text",
        text: "Я вижу все сделки, лиды, задачи и историю команды. Могу найти потерянных клиентов, объяснить изменения в цифрах, собрать сводку по клиенту или составить план на день. Спросите своими словами — например, «сводка по Кофейне Зерно».",
      },
    ],
    followUps: SUGGESTIONS.slice(0, 4),
  };
}

export function answer(question: string, ctx: AiContext): AiAnswer {
  const q = normalize(question);
  const has = (...words: string[]) => words.some((w) => q.includes(w));
  if (has("сводк", "расскажи о", "кто такой", "клиент ")) {
    const summary = clientSummary(ctx, question);
    if (summary) return summary;
  }
  if (has("лид") && has("потер", "забыт", "без ответа", "найди", "упуст")) return lostLeads(ctx);
  if (has("конверс")) return conversion(ctx);
  if (has("риск", "завис", "застр", "горит")) return atRisk(ctx);
  if (has("менеджер", "сотрудник", "команд")) return managers(ctx);
  if (has("сегодня", "первую очередь", "что делать", "план", "приоритет")) return todayPlan(ctx);
  if (has("продаж", "выручк", "прогноз", "деньг")) return sales(ctx);
  return clientSummary(ctx, question) ?? overview(ctx);
}

export interface Insight {
  title: string;
  text: string;
  prompt: string;
  tone: "warning" | "success" | "default";
}

/** Короткие наблюдения для боковой панели — пересчитываются из данных */
export function insights(ctx: AiContext): Insight[] {
  const out: Insight[] = [];
  const w = getPeriodWindow("30d", ctx.now);
  const leads = leadsBetween(ctx.leads, w.start, w.end);
  const won = wonBetween(ctx.deals, w.start, w.end);
  const revenue = won.reduce((a, d) => a + d.amount, 0) || 1;
  const topLeadSource = SOURCES.map((s) => ({ s, leads: leads.filter((l) => l.source === s.id).length, revenue: won.filter((d) => d.source === s.id).reduce((a, d) => a + d.amount, 0) })).sort(
    (a, b) => b.leads - a.leads,
  )[0];
  if (topLeadSource && leads.length) {
    const leadShare = topLeadSource.leads / leads.length;
    const revenueShare = topLeadSource.revenue / revenue;
    out.push({
      title: `${topLeadSource.s.label}: ${formatPercent(leadShare)} заявок`,
      text: `и ${formatPercent(revenueShare)} выручки за 30 дней. ${revenueShare < leadShare ? "Канал даёт объём, но не деньги." : "Канал окупает внимание команды."}`,
      prompt: "Почему изменилась конверсия?",
      tone: revenueShare < leadShare ? "warning" : "success",
    });
  }
  const stale = ctx.deals.filter((d) => isOpen(d) && ctx.now - Date.parse(d.lastActivityAt) > STALE_DEAL_DAYS * DAY);
  if (stale.length)
    out.push({
      title: `${stale.length} ${plural(stale.length, ["сделка зависла", "сделки зависли", "сделок зависло"])}`,
      text: `на ${formatMoneyCompact(stale.reduce((a, d) => a + d.amount, 0))} — без движения больше недели.`,
      prompt: "Какие сделки под риском?",
      tone: "warning",
    });
  const perf = teamPerformance(ctx.members, ctx, "3m", ctx.now).filter((r) => r.avgCycleDays !== null && r.won >= 3);
  if (perf.length > 1) {
    const avgCycle = perf.reduce((a, r) => a + r.avgCycleDays!, 0) / perf.length;
    const fastest = [...perf].sort((a, b) => a.avgCycleDays! - b.avgCycleDays!)[0]!;
    if (fastest.avgCycleDays! < avgCycle * 0.9)
      out.push({
        title: `${fastest.member.name.split(" ")[0]} закрывает быстрее всех`,
        text: `средний цикл ${Math.round(fastest.avgCycleDays!)} дн. против ${Math.round(avgCycle)} по команде. Стоит разобрать её подход.`,
        prompt: "Проанализируй работу менеджеров",
        tone: "success",
      });
  }
  const resp = averageResponse(leads);
  if (resp !== null)
    out.push({
      title: `Ответ лиду: ${formatDuration(resp)}`,
      text: resp <= LEAD_RESPONSE_SLA_MIN ? "в пределах цели в 30 минут — хорошая скорость." : "дольше цели в 30 минут — часть заявок остывает.",
      prompt: "Найди потерянные лиды",
      tone: resp <= LEAD_RESPONSE_SLA_MIN ? "success" : "warning",
    });
  return out;
}
