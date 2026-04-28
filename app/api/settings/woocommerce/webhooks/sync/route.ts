import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { serverPublicBaseUrl } from "@/lib/config/public-url";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import {
  syncWooCommerceOrderWebhooks,
  type WooRestCredentials,
} from "@/lib/integrations/woocommerce-rest";
import {
  getTenantIntegrations,
  getTenantWooCommerceWebhookSecret,
} from "@/lib/services/tenant-settings.service";
import { getTenant } from "@/lib/services/tenants.service";

export const runtime = "nodejs";

function resolveCredentials(input: {
  storeUrl?: string;
  consumerKey?: string;
  consumerSecret?: string;
}): WooRestCredentials | null {
  const storeUrl = input.storeUrl?.trim() ?? "";
  const consumerKey = input.consumerKey?.trim() ?? "";
  const consumerSecret = input.consumerSecret?.trim() ?? "";
  if (!storeUrl || !consumerKey || !consumerSecret) return null;
  return { storeUrl, consumerKey, consumerSecret };
}

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:settings");
    assertCan(ctx, "user:manage");

    const [integrations, tenant, secret] = await Promise.all([
      getTenantIntegrations(ctx.tenantId),
      getTenant(ctx.tenantId),
      getTenantWooCommerceWebhookSecret(ctx.tenantId),
    ]);
    const credentials = resolveCredentials(integrations.woocommerce ?? {});
    if (!credentials) {
      return jsonError(
        "WooCommerce REST store URL, consumer key, and consumer secret are required.",
        400,
      );
    }
    if (!secret) {
      return jsonError("WooCommerce webhook secret is required.", 400);
    }

    const base = serverPublicBaseUrl();
    if (!base) {
      return jsonError(
        "NEXT_PUBLIC_APP_URL or VERCEL_URL is required to build the webhook delivery URL.",
        400,
      );
    }

    const tenantKey = tenant?.slug?.trim() || ctx.tenantId;
    const deliveryUrl = `${base}/api/webhooks/woocommerce?tenant=${encodeURIComponent(tenantKey)}`;
    const results = await syncWooCommerceOrderWebhooks({
      credentials,
      deliveryUrl,
      secret,
    });

    return jsonOk({ deliveryUrl, results });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function GET() {
  return jsonError("Method not allowed", 405);
}
