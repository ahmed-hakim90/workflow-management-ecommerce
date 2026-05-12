import {
  clientIp,
  enforceRateLimitResponse,
} from "@/lib/http/upstash-ratelimit";
import { getTenantWhatsAppCloud } from "@/lib/services/tenant-settings.service";
import { resolveTenantByIdOrSlug } from "@/lib/services/tenants.service";
import { appendWhatsAppWebhookLog } from "@/lib/services/chat/webhook-logs.service";
import {
  processWhatsAppWebhookCore,
  verifyWhatsAppWebhookIngress,
} from "@/lib/services/chat/whatsapp-webhook-processor.service";
import {
  isQStashQueueEnabled,
  publishWhatsAppInboundJob,
} from "@/lib/services/queue/qstash-queue.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tenantKey = url.searchParams.get("tenant")?.trim() || "default";
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const tenant = await resolveTenantByIdOrSlug(tenantKey);
  if (!tenant) {
    return new Response("Forbidden", { status: 403 });
  }

  const wa = await getTenantWhatsAppCloud(tenant.id);
  const expected = wa.verifyToken?.trim();
  if (
    mode === "subscribe" &&
    verifyToken &&
    expected &&
    verifyToken === expected &&
    challenge
  ) {
    await appendWhatsAppWebhookLog({
      tenantId: tenant.id,
      outcome: "verify_ok",
      httpStatus: 200,
    });
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  await appendWhatsAppWebhookLog({
    tenantId: tenant.id,
    outcome: "verify_failed",
    httpStatus: 403,
  });
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const url = new URL(req.url);
  const tenantKey = url.searchParams.get("tenant")?.trim() || "default";
  const tenant = await resolveTenantByIdOrSlug(tenantKey);
  if (!tenant) {
    return new Response(JSON.stringify({ error: "unknown_tenant" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const limited = await enforceRateLimitResponse(req, {
    name: "whatsapp_webhook",
    max: 120,
    window: "1 m",
    identifier: `${tenant.id}:${clientIp(req)}`,
  });
  if (limited) return limited;

  const sig = req.headers.get("x-hub-signature-256");
  const verified = await verifyWhatsAppWebhookIngress({
    tenantId: tenant.id,
    rawBody,
    signatureHeader: sig,
  });
  if (!verified.ok) {
    return new Response(null, { status: verified.httpStatus });
  }

  if (isQStashQueueEnabled()) {
    await publishWhatsAppInboundJob({
      tenantId: tenant.id,
      rawBody,
    });
    return new Response(null, { status: 200 });
  }

  const result = await processWhatsAppWebhookCore({
    tenantId: tenant.id,
    rawBody,
    body: verified.body,
  });

  return new Response(null, { status: result.httpStatus });
}
