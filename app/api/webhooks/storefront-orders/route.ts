import { createHash, timingSafeEqual } from "crypto";
import { z } from "zod";
import { jsonOk, jsonError } from "@/lib/http/json";
import { mapWooCommerceOrder } from "@/lib/integrations/woocommerce-map";
import { upsertOrderFromWooCommerce } from "@/lib/services/orders.service";
import {
  claimIntegrationEvent,
  releaseIntegrationEventClaim,
} from "@/lib/services/integration-events.service";
import { appendWebhookIngestLog } from "@/lib/services/webhook-ingest-logs.service";
import { getTenantStorefrontOrderWebhookSettings } from "@/lib/services/tenant-settings.service";
import { resolveTenantByIdOrSlug } from "@/lib/services/tenants.service";

export const runtime = "nodejs";

const SOURCE = "storefront_order_forwarding";

const forwardedOrderSchema = z
  .object({
    event: z.literal("order.created"),
    source: z.string().optional(),
    order: z.unknown().refine((v) => v !== undefined, {
      message: "Missing forwarded order",
    }),
  })
  .loose();

function bodySha(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex").slice(0, 32);
}

function wooOrderIdFromForwardedBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || !("order" in body)) return undefined;
  const order = (body as { order?: unknown }).order;
  if (order && typeof order === "object" && "id" in order) {
    const id = (order as { id?: unknown }).id;
    if (id !== undefined && id !== null) return String(id);
  }
  return undefined;
}

function resolveForwardedDeliveryId(req: Request, rawBody: string): string {
  const headerDeliveryId =
    req.headers.get("x-order-forwarding-delivery-id")?.trim() ||
    req.headers.get("x-storefront-delivery-id")?.trim() ||
    req.headers.get("x-idempotency-key")?.trim();
  if (headerDeliveryId) return headerDeliveryId;
  return `body-sha256-${bodySha(rawBody)}`;
}

function secretMatches(actual: string | null, expected: string): boolean {
  const a = actual?.trim();
  const e = expected.trim();
  if (!a || !e) return false;
  try {
    const actualBuffer = Buffer.from(a);
    const expectedBuffer = Buffer.from(e);
    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const requestBodyBytes = rawBody.length;
  const deliveryId = resolveForwardedDeliveryId(req, rawBody);
  const tenantKey = new URL(req.url).searchParams.get("tenant")?.trim() || "default";
  const tenant = await resolveTenantByIdOrSlug(tenantKey);
  if (!tenant) {
    return jsonError("Unknown tenant in webhook URL", 404, { tenant: tenantKey });
  }
  const tenantId = tenant.id;

  const settings = await getTenantStorefrontOrderWebhookSettings(tenantId);
  if (!settings.webhookSecret) {
    await appendWebhookIngestLog({
      tenantId,
      source: SOURCE,
      deliveryId,
      outcome: "no_secret_503",
      httpStatus: 503,
      requestBodyBytes,
    });
    return jsonError("Storefront order webhook secret not configured", 503);
  }

  const secretHeader = req.headers.get(settings.secretHeaderName);
  if (!secretMatches(secretHeader, settings.webhookSecret)) {
    await appendWebhookIngestLog({
      tenantId,
      source: SOURCE,
      deliveryId,
      outcome: "invalid_secret_401",
      httpStatus: 401,
      requestBodyBytes,
    });
    return jsonError("Invalid storefront order secret", 401);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    await appendWebhookIngestLog({
      tenantId,
      source: SOURCE,
      deliveryId,
      outcome: "invalid_json_400",
      httpStatus: 400,
      requestBodyBytes,
    });
    return jsonError("Invalid JSON", 400);
  }

  const parsed = forwardedOrderSchema.safeParse(body);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const msg = issue?.message ?? "Invalid forwarded order payload";
    await appendWebhookIngestLog({
      tenantId,
      source: SOURCE,
      deliveryId,
      outcome: "invalid_payload_400",
      httpStatus: 400,
      errorMessage: msg,
      wooOrderId: wooOrderIdFromForwardedBody(body),
      requestBodyBytes,
    });
    return jsonError(msg, 400);
  }

  let claim: "new" | "duplicate";
  try {
    claim = await claimIntegrationEvent({
      tenantId,
      source: SOURCE,
      deliveryId,
      payloadSummary: {
        bytes: rawBody.length,
        source: parsed.data.source ?? null,
        wooOrderId: wooOrderIdFromForwardedBody(body) ?? null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Idempotency claim failed";
    await appendWebhookIngestLog({
      tenantId,
      source: SOURCE,
      deliveryId,
      outcome: "claim_failed_500",
      httpStatus: 500,
      errorMessage: msg,
      wooOrderId: wooOrderIdFromForwardedBody(body),
      requestBodyBytes,
    });
    return jsonError("Could not process forwarded order; retry later.", 500);
  }

  if (claim === "duplicate") {
    await appendWebhookIngestLog({
      tenantId,
      source: SOURCE,
      deliveryId,
      outcome: "duplicate_200",
      httpStatus: 200,
      wooOrderId: wooOrderIdFromForwardedBody(body),
      requestBodyBytes,
    });
    return jsonOk({ duplicate: true });
  }

  try {
    const mapped = mapWooCommerceOrder(parsed.data.order);
    const order = await upsertOrderFromWooCommerce({
      tenantId,
      wooOrderId: mapped.wooOrderId,
      customer: mapped.customer,
      payment: mapped.payment,
      actorUserId: "system:storefront-order-forwarding",
      lineItems: mapped.lineItems,
      shipping: mapped.shipping,
      notes: mapped.notes,
      woocommerceOrderSnapshot: parsed.data.order,
    });
    await appendWebhookIngestLog({
      tenantId,
      source: SOURCE,
      deliveryId,
      outcome: "order_upserted_200",
      httpStatus: 200,
      orderId: order.id,
      wooOrderId: mapped.wooOrderId,
      requestBodyBytes,
    });
    return jsonOk({ orderId: order.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Forwarded order processing failed";
    const wooId = wooOrderIdFromForwardedBody(body);
    let errDetail = msg;
    try {
      await releaseIntegrationEventClaim({
        tenantId,
        source: SOURCE,
        deliveryId,
      });
    } catch (re) {
      const rmsg = re instanceof Error ? re.message : String(re);
      errDetail = `${msg} (release: ${rmsg})`;
    }
    await appendWebhookIngestLog({
      tenantId,
      source: SOURCE,
      deliveryId,
      outcome: "processing_failed_400",
      httpStatus: 400,
      errorMessage: errDetail,
      wooOrderId: wooId,
      requestBodyBytes,
    });
    console.error(
      JSON.stringify({
        event: "storefront_order_forwarding_not_persisted",
        tenantId,
        deliveryId,
        error: errDetail,
      }),
    );
    return jsonError(msg, 400);
  }
}
