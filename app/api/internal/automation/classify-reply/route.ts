import { z } from "zod";
import { getServerEnv } from "@/lib/config/env";
import { jsonError, jsonOk } from "@/lib/http/json";
import { getChatConversation } from "@/lib/services/chat/conversations.service";
import { recordReplyClassification } from "@/lib/services/chat/reply-classification.service";
import type { ReplyIntent } from "@/lib/logic/reply-intent-classify";

export const runtime = "nodejs";

const intentInputSchema = z.enum([
  "confirm",
  "cancel",
  "address_change",
  "change_address",
  "ask_shipping",
  "inquiry",
  "complaint",
  "greeting",
  "return_request",
  "exchange_request",
  "unknown",
  "unclear",
]);

function toCanonicalIntent(raw: z.infer<typeof intentInputSchema>): ReplyIntent {
  switch (raw) {
    case "inquiry":
      return "ask_shipping";
    case "unclear":
      return "unknown";
    case "change_address":
      return "address_change";
    default:
      return raw;
  }
}

const bodySchema = z.object({
  tenantId: z.string().min(1),
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  orderId: z.string().min(1).optional().nullable(),
  intent: intentInputSchema,
  confidence: z.number().min(0).max(1),
  source: z.enum(["heuristic", "n8n", "llm", "manual"]).default("n8n"),
  rawLabel: z.string().max(500).optional(),
  reason: z.string().max(500).optional(),
  departmentHint: z
    .enum(["confirmation", "shipping", "support", "returns"])
    .optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  bodyPreview: z.string().max(2000).optional(),
  /** Default true: below threshold moves thread to human queue. */
  escalateOnLowConfidence: z.boolean().optional(),
});

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

  const conv = await getChatConversation(
    parsed.data.tenantId,
    parsed.data.conversationId,
  );
  if (!conv) {
    return jsonError("Conversation not found", 404);
  }

  await recordReplyClassification({
    tenantId: parsed.data.tenantId,
    conversationId: parsed.data.conversationId,
    messageId: parsed.data.messageId,
    orderId: parsed.data.orderId ?? conv.linkedOrderId,
    intent: toCanonicalIntent(parsed.data.intent),
    confidence: parsed.data.confidence,
    source: parsed.data.source,
    rawLabel: parsed.data.rawLabel,
    reason: parsed.data.reason,
    departmentHint: parsed.data.departmentHint,
    confidenceThreshold: parsed.data.confidenceThreshold,
    bodyPreview: parsed.data.bodyPreview,
    escalateOnLowConfidence: parsed.data.escalateOnLowConfidence,
  });

  return jsonOk({ ok: true });
}
