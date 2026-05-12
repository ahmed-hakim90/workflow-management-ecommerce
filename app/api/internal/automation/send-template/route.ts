import crypto from "node:crypto";
import { z } from "zod";
import { getServerEnv } from "@/lib/config/env";
import { jsonError, jsonOk } from "@/lib/http/json";
import { getChatConversation } from "@/lib/services/chat/conversations.service";
import { executeOutboundTemplateSend } from "@/lib/services/chat/whatsapp-template-send.service";
import {
  isOutboundWhatsAppQueueEnabled,
  publishOutgoingWhatsAppTemplateJob,
} from "@/lib/services/queue/oms-queue.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  tenantId: z.string().min(1),
  conversationId: z.string().min(1),
  templateName: z.string().min(1),
  languageCode: z.string().min(2).max(10),
  bodyParameters: z
    .array(z.object({ type: z.literal("text"), text: z.string() }))
    .optional(),
  /** لمفتاح إزالة التكرار في الطابور؛ يُشتق تلقائياً إن وُجدت الطابور. */
  dedupeKey: z.string().min(4).max(200).optional(),
});

function defaultDedupeKey(input: {
  conversationId: string;
  templateName: string;
  bodyParameters?: { type: "text"; text: string }[];
}): string {
  const raw = JSON.stringify({
    c: input.conversationId,
    t: input.templateName,
    p: input.bodyParameters ?? [],
  });
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 40);
}

export async function POST(req: Request) {
  const secret = getServerEnv().AUTOMATION_SECRET?.trim();
  if (!secret) {
    return jsonError("Automation not configured", 503);
  }
  const auth = req.headers.get("authorization")?.trim();
  if (auth !== `Bearer ${secret}`) {
    return jsonError("Unauthorized", 401);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(parsed.error.message, 400);
  }

  const {
    tenantId,
    conversationId,
    templateName,
    languageCode,
    bodyParameters,
    dedupeKey: clientDedupe,
  } = parsed.data;

  const conv = await getChatConversation(tenantId, conversationId);
  if (!conv) {
    return jsonError("Conversation not found", 404);
  }

  if (conv.humanTakeover) {
    return jsonError("human_takeover_active", 409);
  }

  if (isOutboundWhatsAppQueueEnabled()) {
    const dedupeKey =
      clientDedupe?.trim() ||
      defaultDedupeKey({ conversationId, templateName, bodyParameters });
    await publishOutgoingWhatsAppTemplateJob({
      tenantId,
      conversationId,
      templateName,
      languageCode,
      bodyParameters,
      dedupeKey,
    });
    return jsonOk({ ok: true, queued: true, dedupeKey });
  }

  const result = await executeOutboundTemplateSend({
    tenantId,
    conversationId,
    templateName,
    languageCode,
    bodyParameters,
    senderUserId: "system:n8n",
  });

  return jsonOk({
    ok: result.ok,
    error: result.ok ? undefined : result.error,
  });
}
