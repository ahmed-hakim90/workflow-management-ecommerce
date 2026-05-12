import { logActivity } from "@/lib/services/activity.service";
import { cancelOrder, confirmOrder } from "@/lib/services/orders.service";
import {
  getChatConversation,
  updateChatConversation,
} from "@/lib/services/chat/conversations.service";
import { emitOmsEvent } from "@/lib/services/events/oms-event-emitter.service";
import { appendOrderEvent } from "@/lib/services/order-events.service";

/**
 * مسار موحّد لـ n8n بعد تصنيف رد العميل — لا يُستدعى من العميل، فقط بمفتاح السيرفر.
 */
export async function runAutomationOrderConfirmation(input: {
  tenantId: string;
  orderId: string;
  action: "confirm" | "cancel" | "needs_human";
  reason?: string;
  conversationId?: string;
}): Promise<void> {
  const { tenantId, orderId, action, reason, conversationId } = input;

  if (action === "confirm") {
    await appendOrderEvent({
      tenantId,
      orderId,
      action: "chat.automation.decision",
      userId: "system:n8n",
      metadata: {
        outcome: "confirm",
        conversationId: conversationId ?? undefined,
      },
    });
    await confirmOrder({
      tenantId,
      orderId,
      actorUserId: "system:n8n",
    });
    await emitOmsEvent({
      source: "worker",
      event: "order.confirmed",
      tenantId,
      orderId,
      conversationId,
    });
    return;
  }

  if (action === "cancel") {
    await appendOrderEvent({
      tenantId,
      orderId,
      action: "chat.automation.decision",
      userId: "system:n8n",
      metadata: {
        outcome: "cancel",
        conversationId: conversationId ?? undefined,
        reason: reason ?? "whatsapp_customer",
      },
    });
    await cancelOrder({
      tenantId,
      orderId,
      actorUserId: "system:n8n",
      reason: reason ?? "whatsapp_customer",
    });
    await emitOmsEvent({
      source: "worker",
      event: "order.cancelled",
      tenantId,
      orderId,
      conversationId,
      metadata: { reason },
    });
    return;
  }

  if (conversationId) {
    const conv = await getChatConversation(tenantId, conversationId);
    if (conv) {
      await updateChatConversation(tenantId, conversationId, {
        status: "pending",
        botEnabled: false,
      });
    }
  }

  await appendOrderEvent({
    tenantId,
    orderId,
    action: "chat.automation.decision",
    userId: "system:n8n",
    metadata: {
      outcome: "needs_human",
      conversationId: conversationId ?? undefined,
      reason: reason ?? undefined,
    },
  });

  await logActivity({
    tenantId,
    action: "conversation.needs_human",
    entityType: "order",
    entityId: orderId,
    userId: "system:n8n",
    metadata: { conversationId, reason },
  });

  await emitOmsEvent({
    source: "worker",
    event: "conversation.needs_human",
    tenantId,
    orderId,
    conversationId,
    metadata: { reason },
  });
}
