/**
 * Логика «Входящих»: кто ждёт ответа, подстановка шаблонов
 * и AI-помощник (черновик ответа и сводка диалога по данным CRM).
 */
import type { Client, Conversation, Deal, Lead, Member, Message } from "@/types/crm";
import type { IndustryPack } from "@/config/industries";
import { LEAD_STATUSES, SOURCE_BY_ID } from "./constants";
import { formatDuration, formatMoney } from "./format";
import { stageLabel } from "./stages";
import { MINUTE } from "./time";

export const lastMessageOf = (messages: Message[]) => messages[messages.length - 1];


/** Диалоги, где клиент молчит дольше трёх дней после своего сообщения, считаем закрытыми */
const WAITING_WINDOW = 3 * 24 * 60 * MINUTE;

export function waitingMinutes(messages: Message[], now: number) {
  const last = lastMessageOf(messages);
  if (!last || last.direction !== "in" || now - Date.parse(last.createdAt) > WAITING_WINDOW) return 0;
  // ждём с первого неотвеченного сообщения
  let first = last;
  for (let i = messages.length - 1; i >= 0 && messages[i]!.direction === "in"; i--) first = messages[i]!;
  return Math.max(0, Math.round((now - Date.parse(first.createdAt)) / MINUTE));
}

export interface TemplateVars {
  name: string;
  manager: string;
  company: string;
}

export const TEMPLATE_VARIABLES = [
  { token: "{имя}", label: "имя клиента" },
  { token: "{менеджер}", label: "ваше имя" },
  { token: "{компания}", label: "название компании" },
] as const;

export function fillTemplate(body: string, vars: TemplateVars) {
  return body.replaceAll("{имя}", vars.name).replaceAll("{менеджер}", vars.manager).replaceAll("{компания}", vars.company);
}

export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;

export const channelLabel = (conversation: Pick<Conversation, "channel">) => SOURCE_BY_ID[conversation.channel].label;

export interface AssistContext {
  conversation: Conversation;
  messages: Message[];
  lead?: Lead;
  deal?: Deal;
  client?: Client;
  me?: Member;
  workspaceName: string;
  pack: IndustryPack;
  now: number;
}

const has = (text: string, pattern: RegExp) => pattern.test(text.toLowerCase());

/** Черновик ответа на последнее сообщение клиента. Менеджер правит и отправляет сам */
export function draftReply(ctx: AssistContext): string {
  const name = firstName(ctx.conversation.contactName);
  const lastIn = [...ctx.messages].reverse().find((m) => m.direction === "in")?.text ?? "";
  const answered = ctx.messages.some((m) => m.direction === "out");

  if (!answered) {
    const greeting = ctx.pack.replyTemplates[0]?.body ?? "Здравствуйте, {имя}! Меня зовут {менеджер}, «{компания}». Расскажите, пожалуйста, подробнее о задаче.";
    return fillTemplate(greeting, { name, manager: firstName(ctx.me?.name ?? ""), company: ctx.workspaceName });
  }
  if (has(lastIn, /дешевл|скидк|рассрочк|по частям|поэтап|помесячн/)) {
    return `${name}, можем сделать скидку 5% при оплате до конца недели или разбить оплату на две части — как вам удобнее?`;
  }
  if (has(lastIn, /сколько|стоимост|цен[аы]|прайс/)) {
    return ctx.deal
      ? `${name}, стоимость по «${ctx.deal.title}» — ${formatMoney(ctx.deal.amount)}. Подготовить счёт?`
      : `${name}, назовём точную стоимость, как только уточним детали. ${ctx.pack.chat.qualify[0] ?? ""}`.trim();
  }
  if (has(lastIn, /договор|сч[её]т|реквизит/)) {
    return `${name}, отправляем договор и счёт сегодня. Оплатить можно по QR-коду в счёте — это займёт минуту.`;
  }
  if (has(lastIn, /когда|срок|начать|достав|записат|ближайш|старт/)) {
    return `${name}, можем начать уже на этой неделе. Удобно созвониться завтра в 11:00, чтобы согласовать детали?`;
  }
  if (has(lastIn, /на связи|есть новости/)) {
    return `${name}, да, на связи! Сейчас всё уточню и вернусь с ответом в течение часа.`;
  }
  if (has(lastIn, /спасибо|договорились|хорошо|отлично|принято|жду|оплатил|перевели|отправили/)) {
    return `Спасибо, ${name}! Если появятся вопросы — пишите в любое время.`;
  }
  return `${name}, спасибо за сообщение! Уточню детали и вернусь с ответом сегодня.`;
}

export interface DialogSummary {
  facts: { label: string; value: string }[];
  next: string;
}

/** Сводка диалога: что нужно клиенту, сколько стоит, где сделка и что делать дальше */
export function summarize(ctx: AssistContext): DialogSummary {
  const facts: DialogSummary["facts"] = [];
  const waiting = waitingMinutes(ctx.messages, ctx.now);
  const firstIn = ctx.messages.find((m) => m.direction === "in")?.text;

  facts.push({ label: "Запрос", value: ctx.deal?.title ?? (firstIn ? `«${firstIn.length > 90 ? `${firstIn.slice(0, 88)}…` : firstIn}»` : "—") });
  const budget = ctx.deal?.amount ?? ctx.lead?.budget ?? null;
  facts.push({ label: ctx.deal ? "Сумма сделки" : "Бюджет", value: budget ? formatMoney(budget) : "Пока не обсуждали" });
  if (ctx.deal) facts.push({ label: "Этап", value: stageLabel(ctx.deal.stage) });
  else if (ctx.lead) facts.push({ label: "Статус лида", value: LEAD_STATUSES[ctx.lead.status].label });
  if (waiting > 0) facts.push({ label: "Ждёт ответа", value: formatDuration(waiting) });

  let next: string;
  if (waiting > 0) next = `Ответить клиенту — он ждёт ${formatDuration(waiting)}. Черновик ответа готов.`;
  else if (ctx.deal?.stage === "won") next = "Сделка оплачена. Спросите отзыв и предложите следующий шаг.";
  else if (ctx.deal?.stage === "negotiation") next = "Отправить договор и счёт, чтобы закрыть сделку.";
  else if (ctx.deal?.stage === "proposal") next = "Уточнить решение по предложению и снять вопросы по цене.";
  else if (ctx.deal) next = "Договориться о созвоне и подготовить предложение.";
  else if (ctx.lead && ctx.lead.status !== "converted" && ctx.lead.status !== "disqualified") next = "Когда клиент подтвердит интерес, создайте сделку — данные перенесутся сами.";
  else next = "Диалог без открытых вопросов.";
  return { facts, next };
}
