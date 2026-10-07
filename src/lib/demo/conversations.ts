/**
 * Демо-переписка: диалоги строятся по реальной истории лида и сделки, поэтому
 * время первого ответа совпадает со скоростью ответа в аналитике, а этап
 * сделки — с тем, о чём говорят в чате.
 */
import type { Channel, Client, Conversation, Deal, Lead, LeadSource, Member, Message } from "@/types/crm";
import type { IndustryPack } from "@/config/industries";
import { formatMoney } from "@/lib/format";
import { DAY, HOUR, MINUTE, iso } from "@/lib/time";
import type { Rng } from "./random";
import { translit } from "./catalog";

const CHANNELS: Channel[] = ["telegram", "max", "whatsapp", "vk", "instagram", "website"];

/** Ответы менеджера на реакцию клиента: подумать, про цену, про сроки */
const REACTION_REPLIES = [
  "Конечно! Если появятся вопросы — пишите, ответим.",
  "Уточним у руководителя, что можем предложить, и вернёмся сегодня.",
  "Можем начать уже на следующей неделе — подберём удобную дату.",
];
export const isChannel = (source: LeadSource): source is Channel => (CHANNELS as string[]).includes(source);

function handleFor(channel: Channel, lead: Lead, rng: Rng) {
  const [first = "", last = ""] = lead.name.split(" ");
  switch (channel) {
    case "telegram":
      return `@${translit(first)}_${translit(last).slice(0, 5)}${rng.chance(0.4) ? rng.int(1, 99) : ""}`;
    case "instagram":
      return `@${translit(first)}.${translit(last)}`;
    case "vk":
      return `vk.com/${translit(first)}${translit(last)}`;
    case "website":
      return lead.email || lead.phone;
    default:
      return lead.phone;
  }
}

interface BuildInput {
  leads: Lead[];
  deals: Deal[];
  clients: Client[];
  members: Member[];
  pack: IndustryPack;
  workspaceName: string;
  now: number;
  rng: Rng;
}

export function buildConversations({ leads, deals, clients, members, pack, workspaceName, now, rng }: BuildInput) {
  const dealById = new Map(deals.map((d) => [d.id, d]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const memberById = new Map(members.map((m) => [m.id, m]));
  let seq = 0;
  const id = (prefix: string) => `${prefix}_${(++seq).toString(36).padStart(4, "0")}`;

  // кого берём в демо-переписку: свежие лиды, живые сделки и недавние оплаты
  const picked = leads.filter((lead) => {
    if (!isChannel(lead.source)) return false;
    const created = Date.parse(lead.createdAt);
    if (lead.status === "new") return true;
    const deal = lead.dealId ? dealById.get(lead.dealId) : undefined;
    if (deal && !deal.closedAt) return now - Date.parse(deal.lastActivityAt) < 16 * DAY;
    if (deal?.stage === "won") return now - Date.parse(deal.closedAt!) < 10 * DAY;
    return now - created < 9 * DAY;
  });

  const conversations: Conversation[] = [];
  const messages: Message[] = [];

  for (const lead of picked) {
    const channel = lead.source as Channel;
    const deal = lead.dealId ? dealById.get(lead.dealId) : undefined;
    const client = lead.clientId ? clientById.get(lead.clientId) : undefined;
    const owner = memberById.get(deal?.ownerId ?? lead.ownerId ?? "");
    const conversationId = id("conv");
    const list: Message[] = [];
    let cursor = Date.parse(lead.createdAt);
    const firstName = lead.name.split(" ")[0] ?? lead.name;

    const push = (direction: "in" | "out", text: string, at: number) => {
      cursor = Math.min(Math.max(at, cursor + MINUTE), now - MINUTE);
      list.push({ id: id("msg"), conversationId, direction, authorId: direction === "out" ? (owner?.id ?? null) : null, text, createdAt: iso(cursor) });
    };

    push("in", lead.message, cursor);

    if (lead.status === "new") {
      if (now - cursor > 70 * MINUTE) push("in", "Подскажите, вы на связи?", cursor + rng.int(40, 65) * MINUTE);
    } else if (lead.firstResponseAt) {
      const question = rng.int(0, pack.chat.qualify.length - 1);
      const greeting = `Здравствуйте, ${firstName}! Меня зовут ${owner?.name.split(" ")[0] ?? "менеджер"}, «${workspaceName}». ${pack.chat.qualify[question]}`;
      push("out", greeting, Date.parse(lead.firstResponseAt));
      push("in", pack.chat.answers[question] ?? pack.chat.answers[0]!, cursor + rng.int(4, 80) * MINUTE);

      if (lead.status === "disqualified") {
        push("out", `Спасибо! Подготовим ${pack.chat.proposal} и пришлём сегодня.`, cursor + rng.int(10, 50) * MINUTE);
        push("in", "Спасибо, пока неактуально. Если что, напишу.", cursor + rng.int(3, 30) * HOUR);
      } else if (lead.status === "qualified") {
        push("out", `Спасибо! Подготовим ${pack.chat.proposal} и пришлём сегодня.`, cursor + rng.int(10, 50) * MINUTE);
      } else if (deal) {
        const stageAt = (index: number) => {
          const change = deal.stageHistory[index];
          return change ? Date.parse(change.at) : cursor + rng.int(2, 20) * HOUR;
        };
        const reached = (index: number) => deal.stageReached >= index || deal.stage === "won";
        if (reached(2)) push("out", `Спасибо! Подготовим ${pack.chat.proposal} и пришлём.`, Math.max(cursor + rng.int(10, 50) * MINUTE, stageAt(2)));
        if (reached(3)) {
          push("out", `Отправили ${pack.chat.proposal}: «${deal.title}» — ${formatMoney(deal.amount)}. Посмотрите, пожалуйста.`, stageAt(3));
          const reaction = rng.int(0, pack.chat.reactions.length - 1);
          push("in", pack.chat.reactions[reaction]!, cursor + rng.int(1, 20) * HOUR);
          // на часть реакций уже ответили, остальные ждут ответа менеджера
          if (reached(4) || rng.chance(0.55)) push("out", REACTION_REPLIES[reaction] ?? REACTION_REPLIES[0]!, cursor + rng.int(8, 90) * MINUTE);
        }
        if (reached(4)) {
          push("out", pack.chat.closeOffer, stageAt(4));
          push("in", pack.chat.closeYes, cursor + rng.int(1, 6) * HOUR);
          if (deal.stage === "won" || rng.chance(0.65)) push("out", "Отлично! Отправляем договор и счёт.", cursor + rng.int(10, 60) * MINUTE);
        }
        if (deal.stage === "won" && deal.closedAt) push("in", pack.chat.paid, Date.parse(deal.closedAt));
      }
    }

    // непрочитанные — подряд идущие входящие в конце, если они свежие
    let unread = 0;
    for (let i = list.length - 1; i >= 0 && list[i]!.direction === "in"; i--) unread++;
    const last = list[list.length - 1]!;
    if (now - Date.parse(last.createdAt) > 3 * DAY) unread = 0;

    conversations.push({
      id: conversationId,
      channel,
      contactName: lead.name,
      handle: handleFor(channel, lead, rng),
      gender: lead.gender,
      leadId: lead.id,
      clientId: client?.id ?? null,
      dealId: deal?.id ?? null,
      ownerId: owner?.id ?? null,
      unread,
      lastMessageAt: last.createdAt,
    });
    messages.push(...list);
  }

  conversations.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  const kept = new Set(conversations.slice(0, 40).map((c) => c.id));
  return {
    conversations: conversations.filter((c) => kept.has(c.id)),
    messages: messages.filter((m) => kept.has(m.conversationId)),
  };
}

