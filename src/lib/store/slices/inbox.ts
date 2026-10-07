/**
 * Переписка с клиентами. Ответ из «Входящих» сам двигает работу:
 * новый лид переходит «В работу» и получает время первого ответа,
 * у сделки и клиента обновляется последняя активность.
 */
import type { ID, Message } from "@/types/crm";
import { uid } from "@/lib/utils";
import { nowIso, type SliceContext } from "../slice-context";

export interface InboxActions {
  /** диалог, где клиент сейчас «печатает» (демо-режим) */
  typingConversationId: ID | null;
  sendMessage: (conversationId: ID, text: string) => Message | null;
  markConversationRead: (conversationId: ID) => void;
  markConversationUnread: (conversationId: ID) => void;
  assignConversation: (conversationId: ID, ownerId: ID) => void;
}

const DEMO_REPLIES = [
  "Спасибо, посмотрю сегодня вечером.",
  "Хорошо, договорились.",
  "Отлично, тогда жду.",
  "Принято, спасибо за быстрый ответ!",
  "Спасибо! Если появятся вопросы, напишу сюда.",
];

/** В демо клиент отвечает один раз на диалог, чтобы показать, как приходят новые сообщения */
const answered = new Set<ID>();

export function createInboxActions({ set, get, touchClient }: SliceContext): InboxActions {
  const simulateReply = (conversationId: ID) => {
    if (answered.has(conversationId) || typeof window === "undefined") return;
    answered.add(conversationId);
    window.setTimeout(() => set({ typingConversationId: conversationId }), 2200);
    window.setTimeout(() => {
      const stamp = nowIso();
      const reply: Message = {
        id: uid("msg"),
        conversationId,
        direction: "in",
        authorId: null,
        text: DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)]!,
        createdAt: stamp,
      };
      set((s) => ({
        typingConversationId: s.typingConversationId === conversationId ? null : s.typingConversationId,
        messages: [...s.messages, reply],
        conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, unread: c.unread + 1, lastMessageAt: stamp } : c)),
      }));
    }, 5600);
  };

  return {
    typingConversationId: null,

    sendMessage: (conversationId, text) => {
      const conversation = get().conversations.find((c) => c.id === conversationId);
      const body = text.trim();
      if (!conversation || !body) return null;
      const stamp = nowIso();
      const message: Message = { id: uid("msg"), conversationId, direction: "out", authorId: get().currentUserId, text: body, createdAt: stamp };
      set((s) => ({
        messages: [...s.messages, message],
        conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, unread: 0, lastMessageAt: stamp, ownerId: c.ownerId ?? s.currentUserId } : c)),
      }));
      if (conversation.leadId) {
        const lead = get().leads.find((l) => l.id === conversation.leadId);
        if (lead?.status === "new") get().updateLead(lead.id, { status: "contacted", ownerId: lead.ownerId ?? get().currentUserId });
      }
      if (conversation.dealId) {
        set((s) => ({ deals: s.deals.map((d) => (d.id === conversation.dealId ? { ...d, lastActivityAt: stamp } : d)) }));
      }
      touchClient(conversation.clientId);
      simulateReply(conversationId);
      return message;
    },

    markConversationRead: (conversationId) =>
      set((s) =>
        s.conversations.some((c) => c.id === conversationId && c.unread > 0)
          ? { conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)) }
          : s,
      ),

    assignConversation: (conversationId, ownerId) => {
      const conversation = get().conversations.find((c) => c.id === conversationId);
      set((s) => ({
        conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, ownerId } : c)),
        leads: conversation?.leadId ? s.leads.map((l) => (l.id === conversation.leadId ? { ...l, ownerId } : l)) : s.leads,
      }));
    },

    markConversationUnread: (conversationId) =>
      set((s) => ({ conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, unread: Math.max(1, c.unread) } : c)) })),
  };
}
