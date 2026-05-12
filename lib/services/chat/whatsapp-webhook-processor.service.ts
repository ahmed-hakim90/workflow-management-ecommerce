import type { JsonValue } from "@/lib/types/models";
import { normalizeCustomerPhone } from "@/lib/logic/phone-normalize";
import { getTenantAutomation } from "@/lib/services/tenant-settings.service";
import { getTenantWhatsAppCloud } from "@/lib/services/tenant-settings.service";
import { resolveWhatsAppAppSecret } from "@/lib/services/chat/whatsapp-cloud-api";
import { verifyMetaWhatsAppSignature } from "@/lib/services/chat/meta-signature";
import {
  normalizeWhatsAppWebhookBody,
  phoneNumberIdFromBody,
} from "@/lib/services/chat/whatsapp-normalize";
import { appendWhatsAppWebhookLog } from "@/lib/services/chat/webhook-logs.service";
import {
  createChatConversation,
  findConversationByCustomerPhone,
} from "@/lib/services/chat/conversations.service";
import { appendIncomingWhatsAppMessage } from "@/lib/services/chat/messages.service";
import { updateMessageStatusByWhatsAppId } from "@/lib/services/chat/messages.service";
import { touchSlaOnInboundCustomerMessage } from "@/lib/services/chat/conversation-sla.service";
import { emitOmsEventDeferred } from "@/lib/services/events/oms-event-emitter.service";
import { appendOrderEvent } from "@/lib/services/order-events.service";
import { classifyCustomerReplyIntent } from "@/lib/services/ai/intent-classifier.service";
import { recordReplyClassification } from "@/lib/services/chat/reply-classification.service";

export type ProcessWebhookPostResult = {
  httpStatus: number;
  outcome:
    | "processed"
    | "invalid_signature"
    | "not_configured"
    | "phone_mismatch"
    | "invalid_json";
};

type VerifyIngressResult =
  | { ok: true; body: unknown }
  | { ok: false; httpStatus: number; outcome: ProcessWebhookPostResult["outcome"] };

/**
 * تحقق توقيع ميتا + JSON فقط — يُستدعى على حافة الويبهوك قبل الطابور.
 */
export async function verifyWhatsAppWebhookIngress(input: {
  tenantId: string;
  rawBody: string;
  signatureHeader: string | null;
}): Promise<VerifyIngressResult> {
  const integration = await getTenantWhatsAppCloud(input.tenantId);
  const appSecret = resolveWhatsAppAppSecret(integration);
  if (!appSecret) {
    await appendWhatsAppWebhookLog({
      tenantId: input.tenantId,
      outcome: "error",
      httpStatus: 503,
      rawBody: input.rawBody,
      errorMessage: "missing_app_secret",
    });
    return { ok: false, httpStatus: 503, outcome: "not_configured" };
  }
  if (
    !verifyMetaWhatsAppSignature(
      input.rawBody,
      input.signatureHeader,
      appSecret,
    )
  ) {
    await appendWhatsAppWebhookLog({
      tenantId: input.tenantId,
      outcome: "invalid_signature",
      httpStatus: 401,
      rawBody: input.rawBody,
    });
    return { ok: false, httpStatus: 401, outcome: "invalid_signature" };
  }

  let body: unknown;
  try {
    body = JSON.parse(input.rawBody) as unknown;
  } catch {
    await appendWhatsAppWebhookLog({
      tenantId: input.tenantId,
      outcome: "error",
      httpStatus: 400,
      errorMessage: "invalid_json",
    });
    return { ok: false, httpStatus: 400, outcome: "invalid_json" };
  }

  return { ok: true, body };
}

/**
 * المعالجة بعد التحقق (على العامل: يُمرَّر body بعد JSON.parse دون توقيع ميتا).
 */
export async function processWhatsAppWebhookCore(input: {
  tenantId: string;
  rawBody: string;
  body: unknown;
}): Promise<ProcessWebhookPostResult> {
  const integration = await getTenantWhatsAppCloud(input.tenantId);
  const phoneId = phoneNumberIdFromBody(input.body);
  const expectedPhoneId = integration.phoneNumberId?.trim();
  if (expectedPhoneId && phoneId && phoneId !== expectedPhoneId) {
    await appendWhatsAppWebhookLog({
      tenantId: input.tenantId,
      phoneNumberId: phoneId,
      outcome: "error",
      httpStatus: 400,
      errorMessage: "phone_number_id_mismatch",
      rawBody: input.rawBody,
    });
    return { httpStatus: 400, outcome: "phone_mismatch" };
  }

  const automation = await getTenantAutomation(input.tenantId);
  const events = normalizeWhatsAppWebhookBody(input.body);
  let hadMessage = false;
  let hadStatus = false;

  for (const ev of events) {
    if (ev.kind === "status") {
      hadStatus = true;
      const statusMap: Record<string, "sent" | "delivered" | "read" | "failed"> =
        {
          sent: "sent",
          delivered: "delivered",
          read: "read",
          failed: "failed",
        };
      const st = statusMap[ev.status];
      if (st) {
        await updateMessageStatusByWhatsAppId({
          tenantId: input.tenantId,
          whatsappMessageId: ev.messageId,
          status: st,
        });
      }
      continue;
    }
    if (ev.kind === "ignored") {
      await appendWhatsAppWebhookLog({
        tenantId: input.tenantId,
        phoneNumberId: phoneId,
        outcome: "ignored",
        httpStatus: 200,
        errorMessage: ev.reason,
      });
      continue;
    }
    if (ev.kind !== "message") continue;

    hadMessage = true;
    const phone = normalizeCustomerPhone(ev.from);
    if (!phone) {
      await appendWhatsAppWebhookLog({
        tenantId: input.tenantId,
        phoneNumberId: phoneId,
        outcome: "ignored",
        httpStatus: 200,
        errorMessage: "empty_phone",
      });
      continue;
    }

    let conv =
      (await findConversationByCustomerPhone(input.tenantId, phone)) ??
      null;
    if (!conv) {
      conv = await createChatConversation({
        tenantId: input.tenantId,
        customerPhone: phone,
        customerName: ev.profileName?.trim() || phone,
        status: "open",
        botEnabled: true,
        humanTakeover: false,
      });
    }

    const meta: Record<string, JsonValue> = { timestamp: ev.timestamp };
    if (ev.mediaId) {
      meta.whatsappMediaId = ev.mediaId;
      if (ev.mimeType) meta.mimeType = ev.mimeType;
      if (ev.fileName) meta.fileName = ev.fileName;
    }
    const appended = await appendIncomingWhatsAppMessage({
      tenantId: input.tenantId,
      conversationId: conv.id,
      whatsappMessageId: ev.messageId,
      body: ev.body,
      type: ev.type,
      customerPhone: phone,
      metadata: meta,
    });

    if (appended.ok && appended.duplicate) {
      await appendWhatsAppWebhookLog({
        tenantId: input.tenantId,
        phoneNumberId: phoneId,
        outcome: "duplicate_message",
        httpStatus: 200,
        messageIds: [ev.messageId],
      });
      continue;
    }
    if (!appended.ok || !("message" in appended)) {
      await appendWhatsAppWebhookLog({
        tenantId: input.tenantId,
        phoneNumberId: phoneId,
        outcome: "error",
        httpStatus: 500,
        messageIds: [ev.messageId],
        errorMessage: "append_failed",
      });
      continue;
    }

    await appendWhatsAppWebhookLog({
      tenantId: input.tenantId,
      phoneNumberId: phoneId,
      outcome: "processed",
      httpStatus: 200,
      messageIds: [ev.messageId],
    });

    await touchSlaOnInboundCustomerMessage({
      tenantId: input.tenantId,
      conversationId: appended.conversation.id,
    });

    const convAfter = appended.conversation;
    const linkedOid = convAfter.linkedOrderId?.trim();
    if (linkedOid) {
      await appendOrderEvent({
        tenantId: input.tenantId,
        orderId: linkedOid,
        action: "chat.incoming",
        userId: "system:whatsapp",
        metadata: {
          conversationId: convAfter.id,
          messageId: appended.message.id,
          bodyPreview: ev.body.slice(0, 500),
          messageType: ev.type,
        },
      });
    }

    if (
      automation.inlineReplyClassifier &&
      !convAfter.humanTakeover &&
      linkedOid
    ) {
      const c = await classifyCustomerReplyIntent({
        tenantId: input.tenantId,
        body: ev.body,
      });
      await recordReplyClassification({
        tenantId: input.tenantId,
        conversationId: convAfter.id,
        messageId: appended.message.id,
        orderId: linkedOid,
        intent: c.intent,
        confidence: c.confidence,
        source: c.provider === "heuristic" ? "heuristic" : "llm",
        departmentHint: c.departmentHint,
        bodyPreview: ev.body,
        escalateOnLowConfidence: true,
        reason: c.reason,
      });
    }

    if (automation.whatsappAutomationEnabled && !convAfter.humanTakeover) {
      emitOmsEventDeferred({
        source: "webhook",
        event: "whatsapp.message.received",
        tenantId: input.tenantId,
        conversationId: convAfter.id,
        messageId: appended.message.id,
        body: ev.body,
        humanTakeover: convAfter.humanTakeover,
        botEnabled: convAfter.botEnabled,
        metadata: {
          linkedOrderId: convAfter.linkedOrderId || undefined,
          customerPhone: phone,
        },
      });
    }
  }

  if (!hadMessage && hadStatus) {
    await appendWhatsAppWebhookLog({
      tenantId: input.tenantId,
      phoneNumberId: phoneId,
      outcome: "status_update_only",
      httpStatus: 200,
    });
  }

  if (!events.length) {
    await appendWhatsAppWebhookLog({
      tenantId: input.tenantId,
      phoneNumberId: phoneId,
      outcome: "ignored",
      httpStatus: 200,
      errorMessage: "no_extractable_events",
    });
  }

  return { httpStatus: 200, outcome: "processed" };
}

/**
 * يعالج POST واتساب: توقيع ميتا، ثم رسائل جديدة أو تحديثات تسليم.
 */
export async function processWhatsAppWebhookPost(input: {
  tenantId: string;
  rawBody: string;
  signatureHeader: string | null;
}): Promise<ProcessWebhookPostResult> {
  const v = await verifyWhatsAppWebhookIngress(input);
  if (!v.ok) {
    return { httpStatus: v.httpStatus, outcome: v.outcome };
  }
  return processWhatsAppWebhookCore({
    tenantId: input.tenantId,
    rawBody: input.rawBody,
    body: v.body,
  });
}
