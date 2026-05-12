import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockChatByPhone,
  mockChatGetConversation,
  mockChatListConversations,
  mockChatUpsertConversation,
} from "@/lib/dev/mock-chat-backend";
import { normalizeCustomerPhone } from "@/lib/logic/phone-normalize";
import type {
  ChatConversation,
  ChatConversationStatus,
  InboxListFilter,
} from "@/lib/types/chat";

const CONV_LIMIT = 200;

function convCap(maxRows?: number): number {
  const n = maxRows ?? CONV_LIMIT;
  return Math.min(CONV_LIMIT, Math.max(1, n));
}

export type ChatConversationListResult = {
  conversations: ChatConversation[];
  /** Conversation id of last row; omit when no more pages. */
  nextCursor: string | null;
};

type ConversationRow = Record<string, unknown> & {
  id: string;
  tenant_id: string;
  channel: "whatsapp";
  customer_phone: string;
  customer_name: string;
  linked_order_id: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  status: ChatConversationStatus;
  bot_enabled: boolean;
  human_takeover: boolean;
  unread_count: number;
  has_unread: boolean;
  last_message_text: string;
  last_message_at: string;
  tags: string[] | null;
  department: string | null;
  automation_paused_reason: string | null;
  sla_first_response_due_at: string | null;
  sla_resolution_due_at: string | null;
  sla_breached_at: string | null;
  sla_warning_sent_at: string | null;
  sla_breached: boolean | null;
  created_at: string;
  updated_at: string;
};

function rowToConversation(row: ConversationRow): ChatConversation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    channel: row.channel,
    customerPhone: row.customer_phone,
    customerName: row.customer_name,
    linkedOrderId: row.linked_order_id ?? "",
    assignedUserId: row.assigned_user_id,
    assignedUserName: row.assigned_user_name,
    status: row.status,
    botEnabled: row.bot_enabled,
    humanTakeover: row.human_takeover,
    unreadCount: row.unread_count,
    hasUnread: row.has_unread,
    lastMessageText: row.last_message_text,
    lastMessageAt: row.last_message_at,
    tags: row.tags ?? [],
    department: row.department,
    automationPausedReason: row.automation_paused_reason,
    slaFirstResponseDueAt: row.sla_first_response_due_at,
    slaResolutionDueAt: row.sla_resolution_due_at,
    slaBreachedAt: row.sla_breached_at,
    slaWarningSentAt: row.sla_warning_sent_at,
    slaBreached: row.sla_breached ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function conversationToRow(conv: ChatConversation) {
  return {
    id: conv.id,
    tenant_id: conv.tenantId,
    channel: conv.channel,
    customer_phone: conv.customerPhone,
    customer_name: conv.customerName,
    linked_order_id: conv.linkedOrderId?.trim() || null,
    assigned_user_id: conv.assignedUserId,
    assigned_user_name: conv.assignedUserName,
    status: conv.status,
    bot_enabled: conv.botEnabled,
    human_takeover: conv.humanTakeover,
    unread_count: conv.unreadCount,
    has_unread: conv.hasUnread,
    last_message_text: conv.lastMessageText,
    last_message_at: conv.lastMessageAt,
    tags: conv.tags ?? [],
    department: conv.department,
    automation_paused_reason: conv.automationPausedReason,
    sla_first_response_due_at: conv.slaFirstResponseDueAt,
    sla_resolution_due_at: conv.slaResolutionDueAt,
    sla_breached_at: conv.slaBreachedAt,
    sla_warning_sent_at: conv.slaWarningSentAt,
    sla_breached: conv.slaBreached ?? false,
    created_at: conv.createdAt,
    updated_at: conv.updatedAt,
  };
}

export async function getChatConversation(
  tenantId: string,
  id: string,
): Promise<ChatConversation | null> {
  if (isDevMockDataEnabled()) {
    return mockChatGetConversation(tenantId, id);
  }
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("chat_conversations")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToConversation(data as ConversationRow) : null;
}

export async function findConversationByCustomerPhone(
  tenantId: string,
  phone: string,
): Promise<ChatConversation | null> {
  const normalized = normalizeCustomerPhone(phone);
  if (!normalized) return null;
  if (isDevMockDataEnabled()) {
    return mockChatByPhone(tenantId, normalized) ?? null;
  }
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("chat_conversations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("customer_phone", normalized)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToConversation(data as ConversationRow) : null;
}

export async function listChatConversations(input: {
  tenantId: string;
  filter: InboxListFilter;
  userId?: string;
  /** When true, only rows with linkedOrderId set (confirmation role). */
  onlyLinkedOrders?: boolean;
  /** Hard cap (default 200, max 200). */
  maxRows?: number;
  /** Substring match on E.164 phone (in-memory filter after query). */
  searchPhoneContains?: string;
  /** Exact match on department field (case-insensitive). */
  department?: string;
  /** Pagination cursor (conversation document id). Ignored when phone/department search filters are set. */
  startAfterId?: string;
}): Promise<ChatConversationListResult> {
  const phoneQ = input.searchPhoneContains?.trim();
  const dept = input.department?.trim().toLowerCase();
  const memoryFilter = !!(phoneQ || dept);

  if (isDevMockDataEnabled()) {
    let rows = mockChatListConversations(input.tenantId, {
      filter: input.filter,
      userId: input.userId,
      linkedOrderIdPrefix: input.onlyLinkedOrders,
    });
    if (input.onlyLinkedOrders) {
      rows = rows.filter((r) => !!r.linkedOrderId?.trim());
    }
    if (phoneQ) {
      rows = rows.filter((r) => r.customerPhone.includes(phoneQ));
    }
    if (dept) {
      rows = rows.filter(
        (r) => (r.department ?? "").trim().toLowerCase() === dept,
      );
    }
    const cap = convCap(input.maxRows);
    const startIdx = memoryFilter
      ? 0
      : input.startAfterId
        ? rows.findIndex((r) => r.id === input.startAfterId)
        : -1;
    const sliceStart = startIdx >= 0 ? startIdx + 1 : 0;
    const page = rows.slice(sliceStart, sliceStart + cap);
    const nextCursor =
      !memoryFilter && sliceStart + cap < rows.length && page.length
        ? page[page.length - 1]!.id
        : null;
    return { conversations: page, nextCursor };
  }

  const t = input.tenantId;
  const cap = convCap(input.maxRows);
  const fetchLimit = memoryFilter ? cap : cap + 1;
  let q = getSupabaseServiceRoleClient()
    .from("chat_conversations")
    .select("*")
    .eq("tenant_id", t);

  if (input.filter === "unread") q = q.eq("has_unread", true);
  else if (input.filter === "mine" && input.userId) q = q.eq("assigned_user_id", input.userId);
  else if (input.filter === "bot") q = q.eq("status", "bot_active");
  else if (input.filter === "needs_human") q = q.eq("status", "pending");
  else if (input.filter === "closed") q = q.eq("status", "closed");
  if (input.onlyLinkedOrders) q = q.not("linked_order_id", "is", null);
  if (!memoryFilter && input.startAfterId?.trim()) q = q.lt("id", input.startAfterId.trim());

  const { data, error } = await q
    .order("last_message_at", { ascending: false })
    .limit(fetchLimit);
  if (error) throw error;
  let rows = (data ?? []).map((row) => rowToConversation(row as ConversationRow));
  if (!memoryFilter && rows.length > cap) rows = rows.slice(0, cap);
  if (input.onlyLinkedOrders) {
    rows = rows.filter((r) => !!r.linkedOrderId?.trim());
  }
  if (phoneQ) {
    rows = rows.filter((r) => r.customerPhone.includes(phoneQ));
  }
  if (dept) {
    rows = rows.filter(
      (r) => (r.department ?? "").trim().toLowerCase() === dept,
    );
  }

  const nextCursor =
    !memoryFilter && (data?.length ?? 0) > cap
      ? (rows[rows.length - 1]?.id ?? null)
      : null;

  return { conversations: rows, nextCursor };
}

export async function listWarehouseLinkedConversations(input: {
  tenantId: string;
  linkedOrderId: string;
}): Promise<ChatConversation[]> {
  if (isDevMockDataEnabled()) {
    return mockChatListConversations(input.tenantId, { filter: "all" }).filter(
      (c) => c.linkedOrderId === input.linkedOrderId,
    );
  }
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("chat_conversations")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("linked_order_id", input.linkedOrderId)
    .order("last_message_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => rowToConversation(row as ConversationRow));
}

export async function createChatConversation(input: {
  tenantId: string;
  customerPhone: string;
  customerName: string;
  linkedOrderId?: string;
  status?: ChatConversationStatus;
  botEnabled?: boolean;
  humanTakeover?: boolean;
}): Promise<ChatConversation> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const phone = normalizeCustomerPhone(input.customerPhone);
  const conv: ChatConversation = {
    id,
    tenantId: input.tenantId,
    channel: "whatsapp",
    customerPhone: phone,
    customerName: input.customerName?.trim() || phone,
    linkedOrderId: input.linkedOrderId?.trim() ?? "",
    assignedUserId: null,
    status: input.status ?? "open",
    botEnabled: input.botEnabled ?? true,
    humanTakeover: input.humanTakeover ?? false,
    tags: [],
    department: null,
    slaBreached: false,
    slaFirstResponseDueAt: null,
    slaBreachedAt: null,
    slaWarningSentAt: null,
    unreadCount: 0,
    hasUnread: false,
    lastMessageText: "",
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
  };
  if (isDevMockDataEnabled()) {
    mockChatUpsertConversation(conv);
    return conv;
  }
  const { error } = await getSupabaseServiceRoleClient()
    .from("chat_conversations")
    .insert(conversationToRow(conv));
  if (error) throw error;
  return conv;
}

export async function updateChatConversation(
  tenantId: string,
  id: string,
  patch: Partial<
    Pick<
      ChatConversation,
      | "customerName"
      | "linkedOrderId"
      | "assignedUserId"
      | "assignedUserName"
      | "status"
      | "botEnabled"
      | "humanTakeover"
      | "unreadCount"
      | "hasUnread"
      | "lastMessageText"
      | "lastMessageAt"
      | "tags"
      | "department"
      | "automationPausedReason"
      | "slaFirstResponseDueAt"
      | "slaResolutionDueAt"
      | "slaBreachedAt"
      | "slaWarningSentAt"
      | "slaBreached"
    >
  >,
): Promise<ChatConversation | null> {
  const prev = await getChatConversation(tenantId, id);
  if (!prev) return null;
  const now = new Date().toISOString();
  const next: ChatConversation = { ...prev, ...patch, updatedAt: now };
  if (isDevMockDataEnabled()) {
    mockChatUpsertConversation(next);
    return next;
  }
  const { error } = await getSupabaseServiceRoleClient()
    .from("chat_conversations")
    .upsert(conversationToRow(next));
  if (error) throw error;
  return next;
}

export async function linkConversationToOrder(input: {
  tenantId: string;
  conversationId: string;
  orderId: string;
}): Promise<ChatConversation | null> {
  return updateChatConversation(input.tenantId, input.conversationId, {
    linkedOrderId: input.orderId,
  });
}
