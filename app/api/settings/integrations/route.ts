import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { serverPublicBaseUrl } from "@/lib/config/public-url";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import {
  getTenantIntegrations,
  getTenantWooCommerceWebhookSecret,
  setTenantBostaFields,
  setTenantWooCommerceWebhookSecret,
} from "@/lib/services/tenant-settings.service";
import { getTenant } from "@/lib/services/tenants.service";

const patchSchema = z
  .object({
    woocommerce_webhook_secret: z.union([z.string().max(8192), z.null()]).optional(),
    bosta_api_key: z.union([z.string().max(500), z.null()]).optional(),
    bosta_base_url: z.union([z.string().max(500), z.null()]).optional(),
  })
  .refine(
    (d) =>
      d.woocommerce_webhook_secret !== undefined ||
      d.bosta_api_key !== undefined ||
      d.bosta_base_url !== undefined,
    { message: "No fields to update" },
  );

function normalizeSecret(raw: string | null): string | null {
  if (raw === null) return null;
  const t = raw.trim();
  return t === "" ? null : t;
}

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx.role, "user:manage");
    const [int, tenant, wooSecret] = await Promise.all([
      getTenantIntegrations(ctx.tenantId),
      getTenant(ctx.tenantId),
      getTenantWooCommerceWebhookSecret(ctx.tenantId),
    ]);
    const base = serverPublicBaseUrl();
    const wooSecretOk = wooSecret !== null;
    return jsonOk({
      tenantId: ctx.tenantId,
      serverPublicBaseUrl: base,
      woocommerceWebhookUrl: `${base}/api/webhooks/woocommerce?tenant=${encodeURIComponent(ctx.tenantId)}`,
      woocommerceWebhookSecretConfigured: wooSecretOk,
      /** Per-tenant staff key (Bearer) works with X-User-Id / X-User-Role; shown only as length hint after onboarding. */
      staffApiKeyConfigured: Boolean(tenant?.staffApiKey?.length),
      staffApiKeyLast4: tenant?.staffApiKey
        ? tenant.staffApiKey.slice(-4)
        : null,
      bostaApiKeyConfigured: !!(int.bosta?.apiKey?.trim()),
      bostaBaseUrl: int.bosta?.baseUrl?.trim() || null,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx.role, "user:manage");
    const json = await req.json();
    const body = patchSchema.parse(json);

    if (body.woocommerce_webhook_secret !== undefined) {
      const secret = normalizeSecret(body.woocommerce_webhook_secret);
      await setTenantWooCommerceWebhookSecret(ctx.tenantId, secret);
    }

    if (
      body.bosta_api_key !== undefined ||
      body.bosta_base_url !== undefined
    ) {
      await setTenantBostaFields(ctx.tenantId, {
        ...(body.bosta_api_key !== undefined
          ? { apiKey: body.bosta_api_key }
          : {}),
        ...(body.bosta_base_url !== undefined
          ? { baseUrl: body.bosta_base_url }
          : {}),
      });
    }

    const int = await getTenantIntegrations(ctx.tenantId);
    const wooConfigured =
      (await getTenantWooCommerceWebhookSecret(ctx.tenantId)) !== null;

    return jsonOk({
      woocommerceWebhookSecretConfigured: wooConfigured,
      bostaApiKeyConfigured: !!(int.bosta?.apiKey?.trim()),
      bostaBaseUrl: int.bosta?.baseUrl?.trim() || null,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
