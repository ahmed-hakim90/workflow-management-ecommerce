import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { processWhatsAppWebhookCore } from "@/lib/services/chat/whatsapp-webhook-processor.service";

export const runtime = "nodejs";

async function handler(req: Request) {
  const json = (await req.json()) as { tenantId?: string; rawBody?: string };
  if (!json.tenantId?.trim() || typeof json.rawBody !== "string") {
    return new Response(JSON.stringify({ error: "bad_body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  let body: unknown;
  try {
    body = JSON.parse(json.rawBody) as unknown;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const result = await processWhatsAppWebhookCore({
    tenantId: json.tenantId.trim(),
    rawBody: json.rawBody,
    body,
  });
  return new Response(null, { status: result.httpStatus });
}

const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
const baseUrl = process.env.OMS_PUBLIC_BASE_URL?.trim();

export const POST =
  currentKey && baseUrl
    ? verifySignatureAppRouter(handler, {
        currentSigningKey: currentKey,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
        url: baseUrl + "/api/internal/workers/whatsapp-inbound",
      })
    : async () =>
        new Response(JSON.stringify({ error: "qstash_not_configured" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
