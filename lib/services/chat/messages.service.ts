import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockChatAppendMessage,
  mockChatDedupeExists,
  mockChatDedupeSet,
  mockChatGetMessage,
  mockChatListMessages,
  mockChatPatchMessage,
  mockChatUpsertConversation,
  mockChatGetConversation,
} from "@/lib/dev/mock-chat-backend";
import type { ChatConversation, ChatMessage, ChatMessageType } from "@/lib/types/chat";
import { getChatConversation } from "@/lib/services/chat/conversations.service";
import { updateChatConversation } from "@/lib/services/chat/conversations.service";
import { touchSlaOnInboundCustomerMessage } from "@/lib/services/chat/conversation-sla.service";

function messageToRow(msg: ChatMessage) {
  return {
    id: msg.id,
    conversation_id: msg.conversationId,
    tenant_id: msg.tenantId,
    direction: msg.direction,
    channel: msg.channel,
    type: msg.type,
    body: msg.body,
    whatsapp_message_id: msg.whatsappMessageId,
    status: msg.status,
    sender_user_id: msg.senderUserId,
    customer_phone: msg.customerPhone,
    metadata: msg.metadata ?? {},
    created_at: msg.createdAt,
  };
}

function rowToMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    tenantId: row.tenant_id as string,
    direction: row.direction as ChatMessage["direction"],
    channel: row.channel as ChatMessage["channel"],
    type: row.type as ChatMessage["type"],
    body: row.body as string,
    whatsappMessageId: row.whatsapp_message_id as string | null,
    status: row.status as ChatMessage["status"],
    senderUserId: row.sender_user_id as string | null,
    customerPhone: row.customer_phone as string | null,
    metadata: row.metadata as ChatMessage["metadata"],
    createdAt: row.created_at as string,
  };
}

export type AppendIncomingResult =
  | { ok: true; duplicate: false; message: ChatMessage; conversation: ChatConversation }
  | { ok: true; duplicate: true }
  | { ok: false; error: string };

/**
 * نرفض تكرار نفس رسالة واتساب لأن ميتا قد تعيد إرسال الـ webhook — dedupe doc يمنع ازدواجية السجل.
 */
export async function appendIncomingWhatsAppMessage(input: {
  tenantId: string;
  conversationId: string;
  whatsappMessageId: string;
  body: string;
  type: ChatMessageType;
  customerPhone: string;
  metadata?: ChatMessage["metadata"];
}): Promise<AppendIncomingResult> {
  const dedupeId = `${input.tenantId}_${input.whatsappMessageId}`;

  if (isDevMockDataEnabled()) {
    if (mockChatDedupeExists(dedupeId)) {
      return { ok: true, duplicate: true };
    }
    mockChatDedupeSet(dedupeId);
    const conv = await getChatConversation(input.tenantId, input.conversationId);
    if (!conv) return { ok: false, error: "conversation_not_found" };
    const now = new Date().toISOString();
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      direction: "incoming",
      channel: "whatsapp",
      type: input.type,
      body: input.body,
      whatsappMessageId: input.whatsappMessageId,
      status: "delivered",
      customerPhone: input.customerPhone,
      metadata: input.metadata,
      createdAt: now,
    };
    mockChatAppendMessage(msg);
    const unreadCount = conv.unreadCount + 1;
    const next: ChatConversation = {
      ...conv,
      lastMessageText: input.body,
      lastMessageAt: now,
      unreadCount,
      hasUnread: true,
      updatedAt: now,
    };
    mockChatUpsertConversation(next);
    return { ok: true, duplicate: false, message: msg, conversation: next };
  }

  try {
    const dedupe = await getSupabaseServiceRoleClient()
      .from("whatsapp_message_dedupe")
      .insert({
        id: dedupeId,
        tenant_id: input.tenantId,
        whatsapp_message_id: input.whatsappMessageId,
      });
    if (dedupe.error) {
      if (dedupe.error.code === "23505") return { ok: true, duplicate: true };
      throw dedupe.error;
    }
      const conv = await getChatConversation(input.tenantId, input.conversationId);
      if (!conv) throw new Error("conversation_not_found");
      const now = new Date().toISOString();
      const msgId = crypto.randomUUID();
      const msg: ChatMessage = {
        id: msgId,
        conversationId: input.conversationId,
        tenantId: input.tenantId,
        direction: "incoming",
        channel: "whatsapp",
        type: input.type,
        body: input.body,
        whatsappMessageId: input.whatsappMessageId,
        status: "delivered",
        customerPhone: input.customerPhone,
        metadata: input.metadata,
        createdAt: now,
      };
      const unreadCount = conv.unreadCount + 1;
      const inserted = await getSupabaseServiceRoleClient()
        .from("chat_messages")
        .insert(messageToRow(msg));
      if (inserted.error) throw inserted.error;
      await updateChatConversation(input.tenantId, input.conversationId, {
          lastMessageText: input.body,
          lastMessageAt: now,
          unreadCount,
          hasUnread: true,
      });
      const nextConv: ChatConversation = {
        ...conv,
        lastMessageText: input.body,
        lastMessageAt: now,
        unreadCount,
        hasUnread: true,
        updatedAt: now,
      };
    void touchSlaOnInboundCustomerMessage({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
    });
    return {
      ok: true,
      duplicate: false,
      message: msg,
      conversation: nextConv,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "transaction_failed";
    if (msg === "conversation_not_found" || msg === "tenant_mismatch") {
      return { ok: false, error: msg };
    }
    throw e;
  }
}

export async function appendOutgoingOrInternalMessage(input: {
  tenantId: string;
  conversationId: string;
  direction: "outgoing" | "internal";
  type: ChatMessageType;
  body: string;
  status: ChatMessage["status"];
  senderUserId?: string | null;
  whatsappMessageId?: string | null;
  customerPhone?: string | null;
  metadata?: ChatMessage["metadata"];
}): Promise<{ message: ChatMessage; conversation: ChatConversation } | null> {
  const conv = await getChatConversation(input.tenantId, input.conversationId);
  if (!conv) return null;
  const now = new Date().toISOString();
  const msgId = crypto.randomUUID();
  const msg: ChatMessage = {
    id: msgId,
    conversationId: input.conversationId,
    tenantId: input.tenantId,
    direction: input.direction,
    channel: "whatsapp",
    type: input.type,
    body: input.body,
    whatsappMessageId: input.whatsappMessageId ?? null,
    status: input.status,
    senderUserId: input.senderUserId ?? null,
    customerPhone: input.customerPhone ?? null,
    metadata: input.metadata,
    createdAt: now,
  };

  if (isDevMockDataEnabled()) {
    mockChatAppendMessage(msg);
    const next: ChatConversation = {
      ...conv,
      lastMessageText: input.body,
      lastMessageAt: now,
      updatedAt: now,
      ...(input.direction === "outgoing"
        ? {}
        : { unreadCount: conv.unreadCount, hasUnread: conv.hasUnread }),
    };
    mockChatUpsertConversation(next);
    return { message: msg, conversation: next };
  }

  const { error } = await getSupabaseServiceRoleClient()
    .from("chat_messages")
    .insert(messageToRow(msg));
  if (error) throw error;
  await updateChatConversation(input.tenantId, input.conversationId, {
    lastMessageText: input.body,
    lastMessageAt: now,
  });
  const updated = await getChatConversation(input.tenantId, input.conversationId);
  return { message: msg, conversation: updated! };
}

export async function updateMessageStatusByWhatsAppId(input: {
  tenantId: string;
  whatsappMessageId: string;
  status: ChatMessage["status"];
}): Promise<boolean> {
  if (isDevMockDataEnabled()) {
    return true;
  }
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("chat_messages")
    .update({ status: input.status })
    .eq("tenant_id", input.tenantId)
    .eq("whatsapp_message_id", input.whatsappMessageId)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function listChatMessagesPaginated(input: {
  tenantId: string;
  conversationId: string;
  limit: number;
  cursor?: string | null;
}): Promise<{ messages: ChatMessage[]; nextCursor: string | null }> {
  const lim = Math.min(Math.max(input.limit, 1), 100);
  if (isDevMockDataEnabled()) {
    const all = mockChatListMessages(input.conversationId, input.tenantId, 500);
    let start = 0;
    if (input.cursor) {
      const idx = all.findIndex((m) => m.id === input.cursor);
      if (idx >= 0) start = idx + 1;
    }
    const page = all.slice(start, start + lim);
    const nextCursor =
      page.length === lim && start + lim < all.length
        ? page[page.length - 1]!.id
        : null;
    return { messages: page, nextCursor };
  }
  let q = getSupabaseServiceRoleClient()
    .from("chat_messages")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("conversation_id", input.conversationId);
  if (input.cursor) q = q.lt("id", input.cursor);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(lim + 1);
  if (error) throw error;
  const docs = (data ?? []).map((row) => rowToMessage(row));
  const hasMore = docs.length > lim;
  const messages = hasMore ? docs.slice(0, lim) : docs;
  const nextCursor =
    hasMore && messages.length ? messages[messages.length - 1]!.id : null;
  return { messages, nextCursor };
}

/** Mark conversation read (agent opened thread). */
export async function getChatMessage(input: {
  tenantId: string;
  conversationId: string;
  messageId: string;
}): Promise<ChatMessage | null> {
  if (isDevMockDataEnabled()) {
    return mockChatGetMessage(
      input.tenantId,
      input.conversationId,
      input.messageId,
    );
  }
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("chat_messages")
    .select("*")
    .eq("id", input.messageId)
    .eq("conversation_id", input.conversationId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToMessage(data) : null;
}

export async function patchChatMessage(input: {
  tenantId: string;
  conversationId: string;
  messageId: string;
  patch: Partial<
    Pick<ChatMessage, "whatsappMessageId" | "status" | "metadata" | "body">
  >;
}): Promise<void> {
  if (isDevMockDataEnabled()) {
    mockChatPatchMessage(
      input.tenantId,
      input.conversationId,
      input.messageId,
      input.patch,
    );
    return;
  }
  const patch: Record<string, unknown> = {};
  if (input.patch.whatsappMessageId !== undefined) patch.whatsapp_message_id = input.patch.whatsappMessageId;
  if (input.patch.status !== undefined) patch.status = input.patch.status;
  if (input.patch.metadata !== undefined) patch.metadata = input.patch.metadata;
  if (input.patch.body !== undefined) patch.body = input.patch.body;
  const { error } = await getSupabaseServiceRoleClient()
    .from("chat_messages")
    .update(patch)
    .eq("id", input.messageId)
    .eq("conversation_id", input.conversationId)
    .eq("tenant_id", input.tenantId);
  if (error) throw error;
}

export async function markConversationRead(
  tenantId: string,
  conversationId: string,
): Promise<void> {
  if (isDevMockDataEnabled()) {
    const c = mockChatGetConversation(tenantId, conversationId);
    if (c) {
      mockChatUpsertConversation({
        ...c,
        unreadCount: 0,
        hasUnread: false,
        updatedAt: new Date().toISOString(),
      });
    }
    return;
  }
  await updateChatConversation(tenantId, conversationId, {
      unreadCount: 0,
      hasUnread: false,
  });
}
