import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { getChatConversation } from "@/lib/services/chat/conversations.service";
import { assertConversationWritable } from "@/lib/services/chat/inbox-access.service";
import {
  appendOutgoingOrInternalMessage,
  patchChatMessage,
} from "@/lib/services/chat/messages.service";
import { sendWhatsAppTextMessage } from "@/lib/services/chat/whatsapp-cloud-api";
import { getTenantWhatsAppCloud } from "@/lib/services/tenant-settings.service";
import { getTenantAutomation } from "@/lib/services/tenant-settings.service";
import { clearSlaOnStaffOutbound } from "@/lib/services/chat/conversation-sla.service";
import { emitOmsEventDeferred } from "@/lib/services/events/oms-event-emitter.service";
import { appendOrderEvent } from "@/lib/services/order-events.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  conversationId: z.string().min(1),
  body: z.string().min(1).max(4096),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "inbox:write");
    const json = await req.json();
    const { conversationId, body: text } = bodySchema.parse(json);

    const conv = await getChatConversation(ctx.tenantId, conversationId);
    if (!conv) {
      const err = new Error("Not found") as Error & { status: number };
      err.status = 404;
      throw err;
    }
    assertConversationWritable(ctx, conv);

    const integration = await getTenantWhatsAppCloud(ctx.tenantId);
    const appended = await appendOutgoingOrInternalMessage({
      tenantId: ctx.tenantId,
      conversationId,
      direction: "outgoing",
      type: "text",
      body: text,
      status: "queued",
      senderUserId: ctx.userId,
      customerPhone: conv.customerPhone,
    });
    if (!appended) {
      const err = new Error("Not found") as Error & { status: number };
      err.status = 404;
      throw err;
    }

    const send = await sendWhatsAppTextMessage({
      integration,
      toE164: conv.customerPhone,
      body: text,
    });

    if (send.ok) {
      await patchChatMessage({
        tenantId: ctx.tenantId,
        conversationId,
        messageId: appended.message.id,
        patch: {
          whatsappMessageId: send.whatsappMessageId,
          status: "sent",
        },
      });
      await clearSlaOnStaffOutbound({
        tenantId: ctx.tenantId,
        conversationId,
      });
      const oid = conv.linkedOrderId?.trim();
      if (oid) {
        await appendOrderEvent({
          tenantId: ctx.tenantId,
          orderId: oid,
          action: "chat.staff_reply",
          userId: ctx.userId,
          metadata: {
            conversationId,
            messageId: appended.message.id,
            bodyPreview: text.slice(0, 500),
            channel: "whatsapp",
          },
        });
      }
    } else {
      await patchChatMessage({
        tenantId: ctx.tenantId,
        conversationId,
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

    const automation = await getTenantAutomation(ctx.tenantId);
    if (automation.whatsappAutomationEnabled && send.ok) {
      emitOmsEventDeferred({
        source: "api",
        event: "whatsapp.message.sent",
        tenantId: ctx.tenantId,
        conversationId: conv.id,
        messageId: appended.message.id,
        body: text,
        humanTakeover: conv.humanTakeover,
        botEnabled: conv.botEnabled,
      });
    }

    return jsonOk({
      ok: send.ok,
      messageId: appended.message.id,
      whatsappError: send.ok ? undefined : send.error,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
