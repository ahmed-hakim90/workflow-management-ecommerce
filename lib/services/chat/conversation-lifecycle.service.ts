import { emitOmsEventDeferred } from "@/lib/services/events/oms-event-emitter.service";
import { getTenantAutomation } from "@/lib/services/tenant-settings.service";

/** تسليم يدوي بين موظفين — يُستدعى بعد تحديث التعيين في الواجهة. */
export async function emitConversationTransferred(input: {
  tenantId: string;
  conversationId: string;
  orderId?: string;
  fromUserId: string | null;
  toUserId: string | null;
  toUserName: string | null;
  actorUserId: string;
}): Promise<void> {
  const automation = await getTenantAutomation(input.tenantId);
  emitOmsEventDeferred({
    source: "api",
    event: "conversation.transferred",
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    orderId: input.orderId,
    skipN8n: !automation.whatsappAutomationEnabled,
    metadata: {
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      toUserName: input.toUserName,
      actorUserId: input.actorUserId,
    },
  });
}

export async function emitConversationEscalated(input: {
  tenantId: string;
  conversationId: string;
  orderId?: string;
  department: string;
  reason?: string;
  actorUserId: string;
}): Promise<void> {
  const automation = await getTenantAutomation(input.tenantId);
  emitOmsEventDeferred({
    source: "api",
    event: "conversation.escalated",
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    orderId: input.orderId,
    skipN8n: !automation.whatsappAutomationEnabled,
    metadata: {
      department: input.department,
      reason: input.reason,
      actorUserId: input.actorUserId,
    },
  });
}

export async function emitConversationFollowupScheduled(input: {
  tenantId: string;
  conversationId: string;
  orderId?: string;
  actorUserId: string;
  note?: string;
}): Promise<void> {
  const automation = await getTenantAutomation(input.tenantId);
  emitOmsEventDeferred({
    source: "api",
    event: "conversation.followup_scheduled",
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    orderId: input.orderId,
    skipN8n: !automation.whatsappAutomationEnabled,
    metadata: {
      actorUserId: input.actorUserId,
      note: input.note,
    },
  });
}
