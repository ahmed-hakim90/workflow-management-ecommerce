import type { N8nOmsEventType } from "@/lib/types/chat";

/** قائمة ثابتة لمطابقة Zod وواجهة الإعدادات — يجب أن تطابق `N8nOmsEventType`. */
export const N8N_OMS_EVENT_IDS = [
  "whatsapp.message.received",
  "whatsapp.message.sent",
  "order.confirmation.requested",
  "order.confirmed",
  "order.cancelled",
  "conversation.needs_human",
  "conversation.assigned",
  "conversation.transferred",
  "conversation.escalated",
  "conversation.followup_scheduled",
  "shipment.created",
  "sla.warning",
  "sla.breached",
  "chat.reply.classified",
  "ticket.created",
] as const satisfies readonly N8nOmsEventType[];
