import { jsonOk, jsonError } from "@/lib/http/json";
import {
  resolveWooCommerceDeliveryId,
  verifyWooCommerceSignature,
} from "@/lib/integrations/woocommerce-webhook";
import { mapWooCommerceOrder } from "@/lib/integrations/woocommerce-map";
import { upsertOrderFromWooCommerce } from "@/lib/services/orders.service";
import {
  claimIntegrationEvent,
  releaseIntegrationEventClaim,
} from "@/lib/services/integration-events.service";
import { appendWebhookIngestLog } from "@/lib/services/webhook-ingest-logs.service";
import { getServerEnv } from "@/lib/config/env";
import { getTenantWooCommerceWebhookSecret } from "@/lib/services/tenant-settings.service";
import { resolveTenantByIdOrSlug } from "@/lib/services/tenants.service";

export const runtime = "nodejs";

function wooOrderIdFromBody(body: unknown): string | undefined {
  if (body && typeof body === "object" && "id" in body) {
    const id = (body as { id?: unknown }).id;
    if (id !== undefined && id !== null) return String(id);
  }
  return undefined;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const requestBodyBytes = rawBody.length;
  const sig = req.headers.get("x-wc-webhook-signature");
  const deliveryId = resolveWooCommerceDeliveryId(req, rawBody);
  const env = getServerEnv();
  const url = new URL(req.url);
  const tenantKey = url.searchParams.get("tenant")?.trim() || "default";
  const isDiagnostic = url.searchParams.get("diagnostic") === "1";
  const tenant = await resolveTenantByIdOrSlug(tenantKey);
  if (!tenant) {
    return jsonError("Unknown tenant in webhook URL", 404, { tenant: tenantKey });
  }
  const tenantId = tenant.id;

  const tenantSecret = await getTenantWooCommerceWebhookSecret(tenantId);
  const secretForVerify = (
    tenantSecret ??
    env.WOOCOMMERCE_WEBHOOK_SECRET ??
    ""
  ).trim();

  if (!secretForVerify) {
    await appendWebhookIngestLog({
      tenantId,
      source: "woocommerce",
      deliveryId,
      outcome: "no_secret_503",
      httpStatus: 503,
      requestBodyBytes,
    });
    return jsonError("Webhook secret not configured for this tenant", 503);
  }

  if (!verifyWooCommerceSignature(rawBody, sig, secretForVerify)) {
    await appendWebhookIngestLog({
      tenantId,
      source: "woocommerce",
      deliveryId,
      outcome: "invalid_signature_401",
      httpStatus: 401,
      requestBodyBytes,
    });
    return jsonError("Invalid webhook signature", 401);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    await appendWebhookIngestLog({
      tenantId,
      source: "woocommerce",
      deliveryId,
      outcome: "invalid_json_400",
      httpStatus: 400,
      requestBodyBytes,
    });
    return jsonError("Invalid JSON", 400);
  }

  let claim: "new" | "duplicate";
  try {
    claim = await claimIntegrationEvent({
      tenantId,
      source: "woocommerce",
      deliveryId,
      payloadSummary: { bytes: rawBody.length },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Idempotency claim failed";
    await appendWebhookIngestLog({
      tenantId,
      source: "woocommerce",
      deliveryId,
      outcome: "claim_failed_500",
      httpStatus: 500,
      errorMessage: msg,
      wooOrderId: wooOrderIdFromBody(body),
      requestBodyBytes,
    });
    
    return jsonError("Could not process webhook (idempotency); retry from WooCommerce.", 500);
  }
  console.log("CLAIM RESULT:", claim);

  if (claim === "duplicate") {
    await appendWebhookIngestLog({
      tenantId,
      source: "woocommerce",
      deliveryId,
      outcome: "duplicate_200",
      httpStatus: 200,
      wooOrderId: wooOrderIdFromBody(body),
      requestBodyBytes,
    });
    console.info(
      JSON.stringify({
        event: "woocommerce_webhook_duplicate_delivery",
        message:
          "Idempotent replay: this delivery was already stored; no new order is created for this request.",
        tenantId,
        deliveryId,
      }),
    );
    return jsonOk({ duplicate: true });
  }

  try {
    const mapped = mapWooCommerceOrder(body);
    if (isDiagnostic) {
      await appendWebhookIngestLog({
        tenantId,
        source: "woocommerce",
        deliveryId,
        outcome: "diagnostic_200",
        httpStatus: 200,
        wooOrderId: mapped.wooOrderId,
        requestBodyBytes,
      });
      return jsonOk({ diagnostic: true, wooOrderId: mapped.wooOrderId });
    }
    const order = await upsertOrderFromWooCommerce({
      tenantId,
      wooOrderId: mapped.wooOrderId,
      customer: mapped.customer,
      payment: mapped.payment,
      actorUserId: "system:woocommerce",
      lineItems: mapped.lineItems,
      shipping: mapped.shipping,
      notes: mapped.notes,
      woocommerceOrderSnapshot: body,
    });
    await appendWebhookIngestLog({
      tenantId,
      source: "woocommerce",
      deliveryId,
      outcome: "order_upserted_200",
      httpStatus: 200,
      orderId: order.id,
      wooOrderId: mapped.wooOrderId,
      requestBodyBytes,
    });
    return jsonOk({ orderId: order.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook processing failed";
    const wooId = wooOrderIdFromBody(body);
    let errDetail = msg;
    try {
      await releaseIntegrationEventClaim({
        tenantId,
        source: "woocommerce",
        deliveryId,
      });
    } catch (re) {
      const rmsg = re instanceof Error ? re.message : String(re);
      errDetail = `${msg} (release: ${rmsg})`;
    }
    await appendWebhookIngestLog({
      tenantId,
      source: "woocommerce",
      deliveryId,
      outcome: "processing_failed_400",
      httpStatus: 400,
      errorMessage: errDetail,
      wooOrderId: wooId,
      requestBodyBytes,
    });
    console.error(
      JSON.stringify({
        event: "woocommerce_webhook_order_not_persisted",
        message:
          "HMAC OK and integration idempotency slot was taken, but order mapping/upsert failed. Slot released so WooCommerce can retry. Check payload shape (Order topic) and Firestore below.",
        tenantId,
        deliveryId,
        error: errDetail,
      }),
    );
    return jsonError(msg, 400);
  }
}
