"use client";

import * as React from "react";
import type { Conversation, ID, Message } from "@/types/crm";
import { packFor } from "@/config/industries";
import { useCrm, useCurrentUser } from "@/hooks/use-crm";
import { lastMessageOf, waitingMinutes, type AssistContext } from "@/lib/inbox";

/** Сообщения по диалогам, отсортированные по времени */
export function useMessagesByConversation() {
  const messages = useCrm((s) => s.messages);
  return React.useMemo(() => {
    const map = new Map<ID, Message[]>();
    for (const m of messages) {
      const list = map.get(m.conversationId);
      if (list) list.push(m);
      else map.set(m.conversationId, [m]);
    }
    for (const list of map.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return map;
  }, [messages]);
}

export function useConversationMessages(conversationId: ID | null | undefined) {
  const byConversation = useMessagesByConversation();
  return (conversationId && byConversation.get(conversationId)) || EMPTY;
}

const EMPTY: Message[] = [];

/** Лид, сделка и клиент, с которыми связан диалог */
export function useConversationContext(conversation: Conversation | undefined) {
  const lead = useCrm((s) => (conversation?.leadId ? s.leads.find((l) => l.id === conversation.leadId) : undefined));
  const deal = useCrm((s) => (conversation?.dealId ? s.deals.find((d) => d.id === conversation.dealId) : undefined));
  const client = useCrm((s) => (conversation?.clientId ? s.clients.find((c) => c.id === conversation.clientId) : undefined));
  const owner = useCrm((s) => (conversation?.ownerId ? s.members.find((m) => m.id === conversation.ownerId) : undefined));
  return { lead, deal, client, owner };
}

export function useAssistContext(conversation: Conversation, messages: Message[], now: number): AssistContext {
  const { lead, deal, client } = useConversationContext(conversation);
  const me = useCurrentUser();
  const workspace = useCrm((s) => s.workspace);
  return { conversation, messages, lead, deal, client, me, workspaceName: workspace.name, pack: packFor(workspace.industry), now };
}

/** Диалог по сделке: сначала прямой, потом через лид или клиента */
export function useDealConversation(dealId: ID, leadId: ID | null, clientId: ID) {
  return useCrm((s) => s.conversations.find((c) => c.dealId === dealId) ?? (leadId ? s.conversations.find((c) => c.leadId === leadId) : undefined) ?? s.conversations.find((c) => c.clientId === clientId));
}

export const useLeadConversation = (leadId: ID) => useCrm((s) => s.conversations.find((c) => c.leadId === leadId));

export const useClientConversation = (clientId: ID) => useCrm((s) => s.conversations.find((c) => c.clientId === clientId));

export function summarizeList(conversations: Conversation[], byConversation: Map<ID, Message[]>, now: number) {
  return conversations.map((conversation) => {
    const messages = byConversation.get(conversation.id) ?? EMPTY;
    return { conversation, last: lastMessageOf(messages), waiting: waitingMinutes(messages, now) };
  });
}
