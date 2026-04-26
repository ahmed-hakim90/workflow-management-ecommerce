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
  setTenantWooCommerceRestFields,
  setTenantWooCommerceWebhookSecret,
} from "@/lib/services/tenant-settings.service";
import { getTenant } from "@/lib/services/tenants.service";

const patchSchema = z
  .object({
    woocommerce_webhook_secret: z.union([z.string().max(8192), z.null()]).optional(),
    woocommerce_store_url: z.union([z.string().max(500), z.null()]).optional(),
    woocommerce_consumer_key: z.union([z.string().max(500), z.null()]).optional(),
    woocommerce_consumer_secret: z.union([z.string().max(500), z.null()]).optional(),
    bosta_api_key: z.union([z.string().max(500), z.null()]).optional(),
    bosta_base_url: z.union([z.string().max(500), z.null()]).optional(),
    bosta_default_city_id: z.union([z.string().max(100), z.null()]).optional(),
    bosta_default_zone_id: z.union([z.string().max(200), z.null()]).optional(),
    bosta_default_building_number: z.union([z.string().max(50), z.null()]).optional(),
    bosta_default_address_line: z.union([z.string().max(500), z.null()]).optional(),
    bosta_package_description: z.union([z.string().max(500), z.null()]).optional(),
  })
  .refine(
    (d) =>
      Object.values(d).some((v) => v !== undefined),
    { message: "No fields to update" },
  );

function normalizeSecret(raw: string | null): string | null {
  if (raw === null) return null;
  const t = raw.trim();
  return t === "" ? null : t;
}

function last4(raw: string | undefined): string | null {
  const t = raw?.trim();
  if (!t || t.length < 4) return null;
  return t.slice(-4);
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
    const woo = int.woocommerce ?? {};
    const ck = woo.consumerKey?.trim();
    const cs = woo.consumerSecret?.trim();
    const su = woo.storeUrl?.trim();
    const wooRestConfigured = Boolean(su && ck && cs);
    const b = int.bosta ?? {};
    return jsonOk({
      tenantId: ctx.tenantId,
      serverPublicBaseUrl: base,
      woocommerceWebhookUrl: `${base}/api/webhooks/woocommerce?tenant=${encodeURIComponent(ctx.tenantId)}`,
      woocommerceWebhookSecretConfigured: wooSecretOk,
      woocommerceRestConfigured: wooRestConfigured,
      woocommerceStoreUrl: su || null,
      woocommerceConsumerKeyLast4: last4(ck ?? undefined),
      woocommerceConsumerSecretLast4: last4(cs ?? undefined),
      /** Per-tenant staff key (Bearer) works with X-User-Id / X-User-Role; shown only as length hint after onboarding. */
      staffApiKeyConfigured: Boolean(tenant?.staffApiKey?.length),
      staffApiKeyLast4: tenant?.staffApiKey
        ? tenant.staffApiKey.slice(-4)
        : null,
      bostaApiKeyConfigured: !!(b.apiKey?.trim()),
      bostaBaseUrl: b.baseUrl?.trim() || null,
      bostaDefaultCityId: b.defaultCityId?.trim() || null,
      bostaDefaultZoneId: b.defaultZoneId?.trim() || null,
      bostaDefaultBuildingNumber: b.defaultBuildingNumber?.trim() || null,
      bostaDefaultAddressLine: b.defaultAddressLine?.trim() || null,
      bostaPackageDescription: b.packageDescription?.trim() || null,
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
      body.woocommerce_store_url !== undefined ||
      body.woocommerce_consumer_key !== undefined ||
      body.woocommerce_consumer_secret !== undefined
    ) {
      await setTenantWooCommerceRestFields(ctx.tenantId, {
        storeUrl: body.woocommerce_store_url,
        consumerKey: body.woocommerce_consumer_key,
        consumerSecret: body.woocommerce_consumer_secret,
      });
    }

    if (
      body.bosta_api_key !== undefined ||
      body.bosta_base_url !== undefined ||
      body.bosta_default_city_id !== undefined ||
      body.bosta_default_zone_id !== undefined ||
      body.bosta_default_building_number !== undefined ||
      body.bosta_default_address_line !== undefined ||
      body.bosta_package_description !== undefined
    ) {
      await setTenantBostaFields(ctx.tenantId, {
        ...(body.bosta_api_key !== undefined
          ? { apiKey: body.bosta_api_key }
          : {}),
        ...(body.bosta_base_url !== undefined
          ? { baseUrl: body.bosta_base_url }
          : {}),
        ...(body.bosta_default_city_id !== undefined
          ? { defaultCityId: body.bosta_default_city_id }
          : {}),
        ...(body.bosta_default_zone_id !== undefined
          ? { defaultZoneId: body.bosta_default_zone_id }
          : {}),
        ...(body.bosta_default_building_number !== undefined
          ? { defaultBuildingNumber: body.bosta_default_building_number }
          : {}),
        ...(body.bosta_default_address_line !== undefined
          ? { defaultAddressLine: body.bosta_default_address_line }
          : {}),
        ...(body.bosta_package_description !== undefined
          ? { packageDescription: body.bosta_package_description }
          : {}),
      });
    }

    const int = await getTenantIntegrations(ctx.tenantId);
    const wooConfigured =
      (await getTenantWooCommerceWebhookSecret(ctx.tenantId)) !== null;
    const woo = int.woocommerce ?? {};
    const wooRestConfigured = Boolean(
      woo.storeUrl?.trim() &&
        woo.consumerKey?.trim() &&
        woo.consumerSecret?.trim(),
    );
    const b = int.bosta ?? {};

    return jsonOk({
      woocommerceWebhookSecretConfigured: wooConfigured,
      woocommerceRestConfigured: wooRestConfigured,
      woocommerceStoreUrl: woo.storeUrl?.trim() || null,
      woocommerceConsumerKeyLast4: last4(woo.consumerKey),
      woocommerceConsumerSecretLast4: last4(woo.consumerSecret),
      bostaApiKeyConfigured: !!(b.apiKey?.trim()),
      bostaBaseUrl: b.baseUrl?.trim() || null,
      bostaDefaultCityId: b.defaultCityId?.trim() || null,
      bostaDefaultZoneId: b.defaultZoneId?.trim() || null,
      bostaDefaultBuildingNumber: b.defaultBuildingNumber?.trim() || null,
      bostaDefaultAddressLine: b.defaultAddressLine?.trim() || null,
      bostaPackageDescription: b.packageDescription?.trim() || null,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
