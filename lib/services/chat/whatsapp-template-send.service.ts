import { clearSlaOnStaffOutbound } from "@/lib/services/chat/conversation-sla.service";
import { getChatConversation } from "@/lib/services/chat/conversations.service";
import {
  appendOutgoingOrInternalMessage,
  patchChatMessage,
} from "@/lib/services/chat/messages.service";
import { sendWhatsAppTemplateMessage } from "@/lib/services/chat/whatsapp-cloud-api";
import { getTenantWhatsAppCloud } from "@/lib/services/tenant-settings.service";
import { appendOrderEvent } from "@/lib/services/order-events.service";

export type OutboundTemplateSendInput = {
  tenantId: string;
  conversationId: string;
  templateName: string;
  languageCode: string;
  bodyParameters?: { type: "text"; text: string }[];
  /** افتراضي n8n — يُستخدم في سجل الرسالة. */
  senderUserId?: string;
};

/**
 * إرسال قالب واتساب من الخادم (مسار API أو عامل الطابور).
 */
export async function executeOutboundTemplateSend(
  input: OutboundTemplateSendInput,
): Promise<{ ok: boolean; error?: string }> {
  const conv = await getChatConversation(input.tenantId, input.conversationId);
  if (!conv) {
    return { ok: false, error: "conversation_not_found" };
  }
  if (conv.humanTakeover) {
    return { ok: false, error: "human_takeover_active" };
  }

  const integration = await getTenantWhatsAppCloud(input.tenantId);
  const send = await sendWhatsAppTemplateMessage({
    integration,
    toE164: conv.customerPhone,
    templateName: input.templateName,
    languageCode: input.languageCode,
    bodyParameters: input.bodyParameters,
  });

  const sender = input.senderUserId ?? "system:n8n";
  const appended = await appendOutgoingOrInternalMessage({
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    direction: "outgoing",
    type: "template",
    body: `[template:${input.templateName}]`,
    status: "queued",
    senderUserId: sender,
    customerPhone: conv.customerPhone,
  });

  if (appended) {
    if (send.ok) {
      await patchChatMessage({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        messageId: appended.message.id,
        patch: {
          whatsappMessageId: send.whatsappMessageId,
          status: "sent",
        },
      });
      await clearSlaOnStaffOutbound({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
      });
    } else {
      await patchChatMessage({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        messageId: appended.message.id,
        patch: {
          status: "failed",
          metadata: { error: send.error },
        },
      });
    }
  }

  const linked = conv.linkedOrderId?.trim();
  if (linked) {
    await appendOrderEvent({
      tenantId: input.tenantId,
      orderId: linked,
      action: "chat.template_sent",
      userId: sender,
      metadata: {
        templateName: input.templateName,
        languageCode: input.languageCode,
        conversationId: input.conversationId,
        channel: "whatsapp",
        ok: send.ok,
        ...(appended ? { messageId: appended.message.id } : {}),
        ...(send.ok ? {} : { error: send.error }),
      },
    });
  }

  return send.ok ? { ok: true } : { ok: false, error: send.error };
}
