/**
 * In-memory chat store when `DEV_MOCK_DATA` is enabled (no Firestore).
 */
import type { ChatConversation, ChatMessage } from "@/lib/types/chat";
import type { InboxListFilter } from "@/lib/types/chat";

const conversations: ChatConversation[] = [];
const messagesByConversation: Record<string, ChatMessage[]> = {};

export function resetMockChatBackend() {
  conversations.length = 0;
  for (const k of Object.keys(messagesByConversation)) {
    delete messagesByConversation[k];
  }
  mockChatClearDedupe();
}

export function mockChatGetConversation(
  tenantId: string,
  id: string,
): ChatConversation | null {
  return (
    conversations.find((c) => c.tenantId === tenantId && c.id === id) ?? null
  );
}

export function mockChatListConversations(
  tenantId: string,
  opts: {
    filter: InboxListFilter;
    userId?: string;
    linkedOrderIdPrefix?: boolean;
  },
): ChatConversation[] {
  let rows = conversations
    .filter((c) => c.tenantId === tenantId)
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );
  switch (opts.filter) {
    case "unread":
      rows = rows.filter((c) => c.hasUnread);
      break;
    case "mine":
      rows = rows.filter((c) => c.assignedUserId === opts.userId);
      break;
    case "bot":
      rows = rows.filter((c) => c.status === "bot_active");
      break;
    case "needs_human":
      rows = rows.filter((c) => c.status === "pending");
      break;
    case "closed":
      rows = rows.filter((c) => c.status === "closed");
      break;
    default:
      break;
  }
  if (opts.linkedOrderIdPrefix) {
    rows = rows.filter((c) => !!c.linkedOrderId?.trim());
  }
  return rows;
}

export function mockChatUpsertConversation(conv: ChatConversation) {
  const i = conversations.findIndex((c) => c.id === conv.id);
  if (i >= 0) conversations[i] = conv;
  else conversations.push(conv);
}

export function mockChatByPhone(
  tenantId: string,
  phone: string,
): ChatConversation | undefined {
  return conversations.find(
    (c) => c.tenantId === tenantId && c.customerPhone === phone,
  );
}

export function mockChatListMessages(
  conversationId: string,
  tenantId: string,
  limit: number,
): ChatMessage[] {
  const all = messagesByConversation[conversationId] ?? [];
  return all
    .filter((m) => m.tenantId === tenantId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit);
}

export function mockChatAppendMessage(m: ChatMessage) {
  const arr = messagesByConversation[m.conversationId] ?? [];
  arr.push(m);
  messagesByConversation[m.conversationId] = arr;
}

export function mockChatGetMessage(
  tenantId: string,
  conversationId: string,
  messageId: string,
): ChatMessage | null {
  const arr = messagesByConversation[conversationId] ?? [];
  const m = arr.find(
    (x) => x.id === messageId && x.tenantId === tenantId,
  );
  return m ?? null;
}

export function mockChatPatchMessage(
  tenantId: string,
  conversationId: string,
  messageId: string,
  patch: Partial<Pick<ChatMessage, "metadata" | "status" | "whatsappMessageId">>,
): boolean {
  const arr = messagesByConversation[conversationId];
  if (!arr) return false;
  const i = arr.findIndex(
    (x) => x.id === messageId && x.tenantId === tenantId,
  );
  if (i < 0) return false;
  arr[i] = { ...arr[i]!, ...patch };
  return true;
}

export function mockChatDedupeExists(id: string): boolean {
  return mockDedupeIds.has(id);
}

export function mockChatDedupeSet(id: string) {
  mockDedupeIds.add(id);
}

const mockDedupeIds = new Set<string>();

function mockChatClearDedupe() {
  mockDedupeIds.clear();
}
