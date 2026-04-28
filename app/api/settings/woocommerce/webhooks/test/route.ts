import { createHmac } from "crypto";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { serverPublicBaseUrl } from "@/lib/config/public-url";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { getTenantWooCommerceWebhookSecret } from "@/lib/services/tenant-settings.service";
import { getTenant } from "@/lib/services/tenants.service";
import { POST as postWooCommerceWebhook } from "@/app/api/webhooks/woocommerce/route";

export const runtime = "nodejs";

function diagnosticWooOrderPayload(wooOrderId: string) {
  return {
    id: wooOrderId,
    billing: {
      first_name: "OMS",
      last_name: "Diagnostic",
      email: "diagnostic@example.test",
      phone: "01000000000",
      address_1: "Diagnostic webhook",
      city: "Cairo",
      country: "EG",
    },
    total: "1.00",
    payment_method: "cod",
    customer_note: "Signed OMS diagnostic webhook; no order is saved.",
    line_items: [
      {
        id: 1,
        name: "Diagnostic item",
        sku: "OMS-DIAGNOSTIC",
        quantity: 1,
        price: "1.00",
        total: "1.00",
      },
    ],
    shipping_lines: [{ method_title: "Diagnostic", total: "0.00" }],
  };
}

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:settings");
    assertCan(ctx, "user:manage");

    const [tenant, secret] = await Promise.all([
      getTenant(ctx.tenantId),
      getTenantWooCommerceWebhookSecret(ctx.tenantId),
    ]);
    if (!secret) {
      return jsonError("WooCommerce webhook secret is required.", 400);
    }

    const base = serverPublicBaseUrl() || new URL(req.url).origin;
    const tenantKey = tenant?.slug?.trim() || ctx.tenantId;
    const deliveryId = `diagnostic-${crypto.randomUUID()}`;
    const payload = diagnosticWooOrderPayload(deliveryId);
    const rawBody = JSON.stringify(payload);
    const signature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    const diagnosticUrl = `${base}/api/webhooks/woocommerce?tenant=${encodeURIComponent(tenantKey)}&diagnostic=1`;
    const res = await postWooCommerceWebhook(
      new Request(diagnosticUrl, {
        method: "POST",
        body: rawBody,
        headers: {
          "content-type": "application/json",
          "x-wc-webhook-signature": signature,
          "x-wc-webhook-delivery-id": deliveryId,
        },
      }),
    );
    const body = (await res.json().catch(() => null)) as unknown;

    if (!res.ok) {
      return jsonError("Diagnostic webhook failed.", res.status, { response: body });
    }

    return jsonOk({
      deliveryId,
      status: res.status,
      response: body,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function GET() {
  return jsonError("Method not allowed", 405);
}
