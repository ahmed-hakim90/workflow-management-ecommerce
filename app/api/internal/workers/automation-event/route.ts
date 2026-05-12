import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { z } from "zod";
import { emitOmsEvent } from "@/lib/services/events/oms-event-emitter.service";
import type { N8nOmsEventType } from "@/lib/types/chat";
import type { OmsEventSource } from "@/lib/types/oms-events";

export const runtime = "nodejs";

const bodySchema = z.object({
  tenantId: z.string().min(1),
  event: z.string().min(1),
  source: z.enum(["worker", "api", "webhook", "cron", "system"]),
  conversationId: z.string().optional(),
  orderId: z.string().optional(),
  messageId: z.string().optional(),
  body: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  skipN8n: z.boolean().optional(),
  humanTakeover: z.boolean().optional(),
  botEnabled: z.boolean().optional(),
});

async function handler(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "bad_body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const d = parsed.data;
  await emitOmsEvent({
    source: d.source as OmsEventSource,
    event: d.event as N8nOmsEventType,
    tenantId: d.tenantId,
    conversationId: d.conversationId,
    orderId: d.orderId,
    messageId: d.messageId,
    body: d.body,
    metadata: d.metadata,
    humanTakeover: d.humanTakeover,
    botEnabled: d.botEnabled,
    skipN8n: d.skipN8n,
  });
  return new Response(null, { status: 200 });
}

const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
const baseUrl = process.env.OMS_PUBLIC_BASE_URL?.trim();

export const POST =
  currentKey && baseUrl
    ? verifySignatureAppRouter(handler, {
        currentSigningKey: currentKey,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
        url: baseUrl + "/api/internal/workers/automation-event",
      })
    : async () =>
        new Response(JSON.stringify({ error: "qstash_not_configured" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
