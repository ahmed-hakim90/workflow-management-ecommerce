import { normalizeCustomerPhone } from "@/lib/logic/phone-normalize";
import { logActivity } from "@/lib/services/activity.service";
import { appendOrderEvent } from "@/lib/services/order-events.service";
import type { Order } from "@/lib/types/models";
import {
  createChatConversation,
  findConversationByCustomerPhone,
  getChatConversation,
  updateChatConversation,
} from "@/lib/services/chat/conversations.service";
import {
  appendOutgoingOrInternalMessage,
  patchChatMessage,
} from "@/lib/services/chat/messages.service";
import { emitOmsEvent } from "@/lib/services/events/oms-event-emitter.service";
import { sendWhatsAppTemplateMessage } from "@/lib/services/chat/whatsapp-cloud-api";
import {
  getTenantAutomation,
  getTenantWhatsAppCloud,
} from "@/lib/services/tenant-settings.service";
import { clearSlaOnStaffOutbound } from "@/lib/services/chat/conversation-sla.service";

/**
 * عند أول إنشاء للطلب من الووكومرس: نربط محادثة واتساب بالعميل ونرسل قالب التأكيد ونُبلغ n8n.
 * لا يُستدعى عند التحديثات لاحقاً لتجنب إزعاج العميل.
 */
export async function onNewOrderWhatsAppConfirmationFlow(input: {
  tenantId: string;
  order: Order;
}): Promise<void> {
  const automation = await getTenantAutomation(input.tenantId);
  if (!automation.whatsappAutomationEnabled) return;

  const phone = normalizeCustomerPhone(input.order.customer.phone);
  if (!phone) return;

  const integration = await getTenantWhatsAppCloud(input.tenantId);
  let conv =
    (await findConversationByCustomerPhone(input.tenantId, phone)) ?? null;

  if (!conv) {
    conv = await createChatConversation({
      tenantId: input.tenantId,
      customerPhone: phone,
      customerName: input.order.customer.name?.trim() || phone,
      linkedOrderId: input.order.id,
      status: "bot_active",
      botEnabled: true,
      humanTakeover: false,
    });
  } else {
    await updateChatConversation(input.tenantId, conv.id, {
      linkedOrderId: input.order.id,
      status: "bot_active",
      botEnabled: true,
      humanTakeover: false,
    });
    conv = (await getChatConversation(input.tenantId, conv.id))!;
  }

  const template = automation.orderConfirmationTemplateName?.trim();
  const lang = (automation.orderConfirmationTemplateLanguage ?? "en").trim();
  if (!template) return;

  const send = await sendWhatsAppTemplateMessage({
    integration,
    toE164: phone,
    templateName: template,
    languageCode: lang,
    bodyParameters: [
      {
        type: "text",
        text: (input.order.customer.name ?? "-").slice(0, 80),
      },
      {
        type: "text",
        text: (
          input.order.wooCommerceOrderId?.trim() ||
          input.order.id.slice(0, 12)
        ).slice(0, 80),
      },
    ],
  });

  const appended = await appendOutgoingOrInternalMessage({
    tenantId: input.tenantId,
    conversationId: conv.id,
    direction: "outgoing",
    type: "template",
    body: `[template:${template}]`,
    status: "queued",
    senderUserId: "system:woocommerce",
    customerPhone: phone,
  });

  if (appended) {
    if (send.ok) {
      await patchChatMessage({
        tenantId: input.tenantId,
        conversationId: conv.id,
        messageId: appended.message.id,
        patch: {
          whatsappMessageId: send.whatsappMessageId,
          status: "sent",
        },
      });
      await clearSlaOnStaffOutbound({
        tenantId: input.tenantId,
        conversationId: conv.id,
      });
    } else {
      await patchChatMessage({
        tenantId: input.tenantId,
        conversationId: conv.id,
        messageId: appended.message.id,
        patch: {
          status: "failed",
          metadata: {
            error: send.error,
            ...(typeof send.status === "number" ? { httpStatus: send.status } : {}),
          },
        },
      });
    }
  }

  await logActivity({
    tenantId: input.tenantId,
    action: "order.whatsapp_confirmation_sent",
    entityType: "order",
    entityId: input.order.id,
    userId: "system:woocommerce",
    metadata: { template, ok: send.ok },
  });

  await appendOrderEvent({
    tenantId: input.tenantId,
    orderId: input.order.id,
    action: "chat.template_sent",
    userId: "system:woocommerce",
    metadata: {
      templateName: template,
      languageCode: lang,
      conversationId: conv.id,
      channel: "whatsapp",
      ok: send.ok,
      ...(appended ? { messageId: appended.message.id } : {}),
      ...(send.ok ? {} : { error: send.error }),
    },
  });

  await emitOmsEvent({
    source: "system",
    event: "order.confirmation.requested",
    tenantId: input.tenantId,
    orderId: input.order.id,
    conversationId: conv.id,
    humanTakeover: conv.humanTakeover,
    botEnabled: conv.botEnabled,
  });
}
