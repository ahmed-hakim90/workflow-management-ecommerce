import type { JsonValue } from "@/lib/types/models";

export type ChatChannel = "whatsapp";

export type ChatConversationStatus =
  | "open"
  | "pending"
  | "bot_active"
  | "human_takeover"
  | "closed"
  | "awaiting_customer_reply"
  | "awaiting_internal_action"
  | "pending_followup";

export interface ChatConversation {
  id: string;
  tenantId: string;
  channel: ChatChannel;
  customerPhone: string;
  customerName: string;
  /** Empty string when no order is linked. */
  linkedOrderId: string;
  assignedUserId?: string | null;
  /** Denormalized for inbox list rows. */
  assignedUserName?: string | null;
  status: ChatConversationStatus;
  botEnabled: boolean;
  humanTakeover: boolean;
  unreadCount: number;
  hasUnread: boolean;
  lastMessageText: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  /** Team-only labels (e.g. VIP, follow-up). */
  tags?: string[];
  /** Queue / escalation bucket for routing (e.g. confirmation, shipping). */
  department?: string | null;
  /** سبب إيقاف الأتمتة مؤقتاً (يظهر للفريق فقط). */
  automationPausedReason?: string | null;
  /** أول رد مطلوب من الفريق بعد رسالة العميل — ISO. */
  slaFirstResponseDueAt?: string | null;
  /** تذكير اختياري لإغلاق المحادثة — ISO. */
  slaResolutionDueAt?: string | null;
  /** عند تجاوز SLA أول رد — ISO. */
  slaBreachedAt?: string | null;
  /** تم إرسال تحذير قبل التجاوز — ISO. */
  slaWarningSentAt?: string | null;
  /** يمنع تكرار أحداث sla.breached. */
  slaBreached?: boolean;
}

export type ChatMessageDirection = "incoming" | "outgoing" | "internal";

export type ChatMessageType =
  | "text"
  | "template"
  | "image"
  | "audio"
  | "document"
  | "interactive";

export type ChatMessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export interface ChatMessage {
  id: string;
  conversationId: string;
  tenantId: string;
  direction: ChatMessageDirection;
  channel: ChatChannel;
  type: ChatMessageType;
  body: string;
  whatsappMessageId?: string | null;
  status: ChatMessageStatus;
  senderUserId?: string | null;
  customerPhone?: string | null;
  metadata?: JsonValue;
  createdAt: string;
}

/** Outbound / inbox events aligned with n8n payloads (`N8nOmsEventType`). */
export type N8nOmsEventType =
  | "whatsapp.message.received"
  | "whatsapp.message.sent"
  | "order.confirmation.requested"
  | "order.confirmed"
  | "order.cancelled"
  | "conversation.needs_human"
  | "conversation.assigned"
  | "conversation.transferred"
  | "conversation.escalated"
  | "conversation.followup_scheduled"
  | "shipment.created"
  | "sla.warning"
  | "sla.breached"
  | "chat.reply.classified"
  | "ticket.created";

/** Optional lifecycle key for automation / n8n (e.g. order_confirm, shipped). */
export type MessageTemplateEventKey =
  | "order_confirm"
  | "ask_address"
  | "shipped"
  | "delivery_failed"
  | "return"
  | "complaint";

export type TemplateApprovalStatus = "pending" | "approved" | "rejected";

export interface MessageTemplate {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  /** When set, ties this row to a product event for automation and reporting. */
  eventKey?: MessageTemplateEventKey;
  /** Meta-approved WhatsApp template name (Cloud API). */
  whatsappTemplateName?: string;
  /** Saved-reply bucket for agents (confirmation, shipping, …). */
  category?: string;
  /** Template manager workflow; only `approved` (or missing) rows appear as inbox quick replies. */
  approvalStatus?: TemplateApprovalStatus;
  /** Link to OMS → n8n event for automation mapping. */
  linkedOmsEvent?: N8nOmsEventType;
  createdAt: string;
  updatedAt: string;
}

export type AutomationRunStatus =
  | "started"
  | "success"
  | "failed"
  | "dead_lettered";

export interface AutomationRun {
  id: string;
  tenantId: string;
  eventType: string;
  status: AutomationRunStatus;
  payloadSummary?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: string;
}

export type WhatsAppWebhookLogOutcome =
  | "verify_ok"
  | "verify_failed"
  | "invalid_signature"
  | "invalid_json"
  | "processed"
  | "duplicate_message"
  | "status_update_only"
  | "ignored"
  | "error";

export interface WhatsAppWebhookLog {
  id: string;
  tenantId: string;
  phoneNumberId?: string;
  outcome: WhatsAppWebhookLogOutcome;
  httpStatus: number;
  messageIds?: string[];
  /** First ~8KB for debugging; never store secrets. */
  rawBodyTruncated?: string;
  errorMessage?: string;
  createdAt: string;
}

/** Inbox list filter (maps to API query). */
export type InboxListFilter =
  | "all"
  | "unread"
  | "mine"
  | "bot"
  | "needs_human"
  | "closed";

/** Suggested conversation tags (any string allowed in `ChatConversation.tags`). */
export const CONVERSATION_TAG_PRESETS = [
  "VIP",
  "Angry Customer",
  "Return Risk",
  "Address Issue",
  "Needs Follow-up",
] as const;
