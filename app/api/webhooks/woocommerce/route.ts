import { jsonOk, jsonError } from "@/lib/http/json";
import { verifyWooCommerceSignature } from "@/lib/integrations/woocommerce-webhook";
import { mapWooCommerceOrder } from "@/lib/integrations/woocommerce-map";
import { upsertOrderFromWooCommerce } from "@/lib/services/orders.service";
import {
  claimIntegrationEvent,
  releaseIntegrationEventClaim,
} from "@/lib/services/integration-events.service";
import { getServerEnv } from "@/lib/config/env";
import { getTenantWooCommerceWebhookSecret } from "@/lib/services/tenant-settings.service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-wc-webhook-signature");
  const env = getServerEnv();
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenant") ?? "default";

  const tenantSecret = await getTenantWooCommerceWebhookSecret(tenantId);
  const secretForVerify = (
    tenantSecret ??
    env.WOOCOMMERCE_WEBHOOK_SECRET ??
    ""
  ).trim();

  if (!secretForVerify) {
    return jsonError("Webhook secret not configured for this tenant", 503);
  }

  if (!verifyWooCommerceSignature(rawBody, sig, secretForVerify)) {
    return jsonError("Invalid webhook signature", 401);
  }

  const deliveryId =
    req.headers.get("x-wc-webhook-delivery-id") ?? `${Date.now()}`;

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const claim = await claimIntegrationEvent({
    tenantId,
    source: "woocommerce",
    deliveryId,
    payloadSummary: { bytes: rawBody.length },
  });
  if (claim === "duplicate") {
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
    const order = await upsertOrderFromWooCommerce({
      tenantId,
      wooOrderId: mapped.wooOrderId,
      customer: mapped.customer,
      payment: mapped.payment,
      actorUserId: "system:woocommerce",
      lineItems: mapped.lineItems,
      shipping: mapped.shipping,
      notes: mapped.notes,
    });
    return jsonOk({ orderId: order.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook processing failed";
    await releaseIntegrationEventClaim({
      tenantId,
      source: "woocommerce",
      deliveryId,
    });
    console.error(
      JSON.stringify({
        event: "woocommerce_webhook_order_not_persisted",
        message:
          "HMAC OK and integration idempotency slot was taken, but order mapping/upsert failed. Slot released so WooCommerce can retry. Check payload shape (Order topic) and Firestore below.",
        tenantId,
        deliveryId,
        error: msg,
      }),
    );
    return jsonError(msg, 400);
  }
}
