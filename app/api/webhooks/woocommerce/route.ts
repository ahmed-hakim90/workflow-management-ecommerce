import { jsonOk, jsonError } from "@/lib/http/json";
import { verifyWooCommerceSignature } from "@/lib/integrations/woocommerce-webhook";
import { mapWooCommerceOrder } from "@/lib/integrations/woocommerce-map";
import { upsertOrderFromWooCommerce } from "@/lib/services/orders.service";
import { claimIntegrationEvent } from "@/lib/services/integration-events.service";
import { getServerEnv } from "@/lib/config/env";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-wc-webhook-signature");
  const env = getServerEnv();
  if (env.WOOCOMMERCE_WEBHOOK_SECRET) {
    if (!verifyWooCommerceSignature(rawBody, sig)) {
      return jsonError("Invalid webhook signature", 401);
    }
  }

  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenant") ?? "default";
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
    return jsonError(msg, 400);
  }
}
