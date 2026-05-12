import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { serverPublicBaseUrl } from "@/lib/config/public-url";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import {
  getTenantIntegrations,
  getTenantStorefrontOrderWebhookSettings,
  getTenantWooCommerceWebhookSecret,
  setTenantBostaFields,
  setTenantFedExFields,
  setTenantJntEgyptFields,
  setTenantStorefrontOrderFields,
  setTenantWhatsAppCloudFields,
  setTenantWooCommerceRestFields,
  setTenantWooCommerceWebhookSecret,
} from "@/lib/services/tenant-settings.service";
import { getServerEnv } from "@/lib/config/env";
import { getTenant } from "@/lib/services/tenants.service";
import { assertTenantCanUseIntegration } from "@/lib/services/platform-packages.service";

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
    jnt_api_account: z.union([z.string().max(500), z.null()]).optional(),
    jnt_customer_code: z.union([z.string().max(500), z.null()]).optional(),
    jnt_password: z.union([z.string().max(500), z.null()]).optional(),
    jnt_digest_secret: z.union([z.string().max(500), z.null()]).optional(),
    jnt_base_url: z.union([z.string().max(500), z.null()]).optional(),
    jnt_environment: z.union([z.enum(["test", "prod"]), z.null()]).optional(),
    jnt_sender_name: z.union([z.string().max(200), z.null()]).optional(),
    jnt_sender_phone: z.union([z.string().max(100), z.null()]).optional(),
    jnt_sender_city: z.union([z.string().max(100), z.null()]).optional(),
    jnt_sender_area: z.union([z.string().max(100), z.null()]).optional(),
    jnt_sender_address: z.union([z.string().max(500), z.null()]).optional(),
    jnt_default_service_code: z.union([z.string().max(100), z.null()]).optional(),
    jnt_default_weight_kg: z.union([z.string().max(50), z.null()]).optional(),
    jnt_default_length_cm: z.union([z.string().max(50), z.null()]).optional(),
    jnt_default_width_cm: z.union([z.string().max(50), z.null()]).optional(),
    jnt_default_height_cm: z.union([z.string().max(50), z.null()]).optional(),
    jnt_package_description: z.union([z.string().max(500), z.null()]).optional(),
    fedex_client_id: z.union([z.string().max(500), z.null()]).optional(),
    fedex_client_secret: z.union([z.string().max(500), z.null()]).optional(),
    fedex_account_number: z.union([z.string().max(100), z.null()]).optional(),
    fedex_base_url: z.union([z.string().max(500), z.null()]).optional(),
    fedex_environment: z.union([z.enum(["test", "prod"]), z.null()]).optional(),
    fedex_shipper_name: z.union([z.string().max(200), z.null()]).optional(),
    fedex_shipper_phone: z.union([z.string().max(100), z.null()]).optional(),
    fedex_shipper_street: z.union([z.string().max(500), z.null()]).optional(),
    fedex_shipper_city: z.union([z.string().max(100), z.null()]).optional(),
    fedex_shipper_state: z.union([z.string().max(50), z.null()]).optional(),
    fedex_shipper_postal_code: z.union([z.string().max(50), z.null()]).optional(),
    fedex_shipper_country_code: z.union([z.string().max(10), z.null()]).optional(),
    fedex_default_service_type: z.union([z.string().max(100), z.null()]).optional(),
    fedex_default_packaging_type: z.union([z.string().max(100), z.null()]).optional(),
    fedex_default_weight_kg: z.union([z.string().max(50), z.null()]).optional(),
    fedex_default_length_cm: z.union([z.string().max(50), z.null()]).optional(),
    fedex_default_width_cm: z.union([z.string().max(50), z.null()]).optional(),
    fedex_default_height_cm: z.union([z.string().max(50), z.null()]).optional(),
    fedex_package_description: z.union([z.string().max(500), z.null()]).optional(),
    storefront_order_webhook_secret: z.union([z.string().max(8192), z.null()]).optional(),
    storefront_order_secret_header_name: z
      .union([
        z
          .string()
          .max(100)
          .regex(/^[!#$%&'*+\-.^_`|~0-9a-zA-Z]+$/, "Invalid HTTP header name"),
        z.null(),
      ])
      .optional(),
    whatsapp_verify_token: z.union([z.string().max(500), z.null()]).optional(),
    whatsapp_access_token: z.union([z.string().max(8192), z.null()]).optional(),
    whatsapp_phone_number_id: z.union([z.string().max(100), z.null()]).optional(),
    whatsapp_business_account_id: z.union([z.string().max(100), z.null()]).optional(),
    whatsapp_app_secret: z.union([z.string().max(500), z.null()]).optional(),
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

function hasEnabledValue(raw: string | null | undefined): boolean {
  return typeof raw === "string" && raw.trim().length > 0;
}

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:settings");
    assertCan(ctx, "user:manage");
    const [int, tenant, wooSecret, storefrontOrderWebhook] = await Promise.all([
      getTenantIntegrations(ctx.tenantId),
      getTenant(ctx.tenantId),
      getTenantWooCommerceWebhookSecret(ctx.tenantId),
      getTenantStorefrontOrderWebhookSettings(ctx.tenantId),
    ]);
    const base = serverPublicBaseUrl();
    const wooSecretOk = wooSecret !== null;
    const woo = int.woocommerce ?? {};
    const ck = woo.consumerKey?.trim();
    const cs = woo.consumerSecret?.trim();
    const su = woo.storeUrl?.trim();
    const wooRestConfigured = Boolean(su && ck && cs);
    const b = int.bosta ?? {};
    const jnt = int.jntEgypt ?? {};
    const fedex = int.fedex ?? {};
    const wa = int.whatsapp ?? {};
    const waToken = wa.accessToken?.trim();
    const waAppSec = wa.appSecret?.trim();
    const serverEnv = getServerEnv();
    const hasServerEnvWooSecret = Boolean(
      serverEnv.WOOCOMMERCE_WEBHOOK_SECRET?.trim(),
    );
    const hasSupabaseConfigured = Boolean(
      serverEnv.SUPABASE_URL?.trim() &&
        serverEnv.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    );
    const hasCustomAppUrl = Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim());
    const hasVercelUrl = Boolean(process.env.VERCEL_URL?.trim());
    const effectiveSecretReady = wooSecretOk || hasServerEnvWooSecret;
    const warnings: string[] = [];
    if (!hasSupabaseConfigured) {
      warnings.push(
        "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set: server cannot persist orders from webhooks.",
      );
    }
    if (!effectiveSecretReady) {
      warnings.push(
        "No HMAC secret: set Integrations → webhook secret or WOOCOMMERCE_WEBHOOK_SECRET in server env, or the webhook returns 503.",
      );
    }
    if (!hasCustomAppUrl && hasVercelUrl) {
      warnings.push(
        "NEXT_PUBLIC_APP_URL is unset: the shown webhook URL may use a deployment host; set a stable production domain in Vercel env.",
      );
    }
    if (!base) {
      warnings.push(
        "No public base URL: set NEXT_PUBLIC_APP_URL, or use a Vercel deployment so VERCEL_URL is set.",
      );
    }
    const hasGlobalWaAppSecret = Boolean(serverEnv.WHATSAPP_APP_SECRET?.trim());
    const hasTenantWaAppSecret = Boolean(waAppSec);
    if (
      wa.verifyToken?.trim() &&
      wa.accessToken?.trim() &&
      wa.phoneNumberId?.trim() &&
      !hasGlobalWaAppSecret &&
      !hasTenantWaAppSecret
    ) {
      warnings.push(
        "WhatsApp webhook POST signatures need WHATSAPP_APP_SECRET in server env or App secret in Integrations.",
      );
    }
    const webhookTenantKey = tenant?.slug?.trim() || ctx.tenantId;
    return jsonOk({
      tenantId: ctx.tenantId,
      serverPublicBaseUrl: base,
      woocommerceWebhookUrl: `${base}/api/webhooks/woocommerce?tenant=${encodeURIComponent(webhookTenantKey)}`,
      whatsappWebhookUrl: `${base}/api/webhooks/whatsapp?tenant=${encodeURIComponent(webhookTenantKey)}`,
      storefrontOrderWebhookUrl: `${base}/api/webhooks/storefront-orders?tenant=${encodeURIComponent(webhookTenantKey)}`,
      storefrontOrderWebhookSecretConfigured:
        storefrontOrderWebhook.webhookSecret !== null,
      storefrontOrderSecretHeaderName: storefrontOrderWebhook.secretHeaderName,
      woocommerceWebhookSecretConfigured: wooSecretOk,
      webhookDiagnostics: {
        hasPerTenantWooSecret: wooSecretOk,
        hasServerEnvWooSecret,
        effectiveSecretReady,
        hasSupabaseConfigured,
        hasCustomAppUrl,
        hasVercelUrl,
        warnings,
      },
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
      jntApiAccountConfigured: Boolean(jnt.apiAccount?.trim()),
      jntCustomerCodeConfigured: Boolean(jnt.customerCode?.trim()),
      jntPasswordConfigured: Boolean(jnt.password?.trim()),
      jntDigestSecretConfigured: Boolean(jnt.digestSecret?.trim()),
      jntBaseUrl: jnt.baseUrl?.trim() || null,
      jntEnvironment: jnt.environment ?? "prod",
      jntSenderName: jnt.senderName?.trim() || null,
      jntSenderPhone: jnt.senderPhone?.trim() || null,
      jntSenderCity: jnt.senderCity?.trim() || null,
      jntSenderArea: jnt.senderArea?.trim() || null,
      jntSenderAddress: jnt.senderAddress?.trim() || null,
      jntDefaultServiceCode: jnt.defaultServiceCode?.trim() || null,
      jntDefaultWeightKg: jnt.defaultWeightKg?.trim() || null,
      jntDefaultLengthCm: jnt.defaultLengthCm?.trim() || null,
      jntDefaultWidthCm: jnt.defaultWidthCm?.trim() || null,
      jntDefaultHeightCm: jnt.defaultHeightCm?.trim() || null,
      jntPackageDescription: jnt.packageDescription?.trim() || null,
      fedexClientIdConfigured: Boolean(fedex.clientId?.trim()),
      fedexClientSecretConfigured: Boolean(fedex.clientSecret?.trim()),
      fedexAccountNumber: fedex.accountNumber?.trim() || null,
      fedexBaseUrl: fedex.baseUrl?.trim() || null,
      fedexEnvironment: fedex.environment ?? "prod",
      fedexShipperName: fedex.shipperName?.trim() || null,
      fedexShipperPhone: fedex.shipperPhone?.trim() || null,
      fedexShipperStreet: fedex.shipperStreet?.trim() || null,
      fedexShipperCity: fedex.shipperCity?.trim() || null,
      fedexShipperState: fedex.shipperStateOrProvinceCode?.trim() || null,
      fedexShipperPostalCode: fedex.shipperPostalCode?.trim() || null,
      fedexShipperCountryCode: fedex.shipperCountryCode?.trim() || null,
      fedexDefaultServiceType: fedex.defaultServiceType?.trim() || null,
      fedexDefaultPackagingType: fedex.defaultPackagingType?.trim() || null,
      fedexDefaultWeightKg: fedex.defaultWeightKg?.trim() || null,
      fedexDefaultLengthCm: fedex.defaultLengthCm?.trim() || null,
      fedexDefaultWidthCm: fedex.defaultWidthCm?.trim() || null,
      fedexDefaultHeightCm: fedex.defaultHeightCm?.trim() || null,
      fedexPackageDescription: fedex.packageDescription?.trim() || null,
      whatsappVerifyTokenConfigured: Boolean(wa.verifyToken?.trim()),
      whatsappPhoneNumberId: wa.phoneNumberId?.trim() || null,
      whatsappBusinessAccountId: wa.businessAccountId?.trim() || null,
      whatsappAccessTokenLast4: last4(waToken),
      whatsappAppSecretLast4: last4(waAppSec),
      whatsappSignatureDiagnostics: {
        hasGlobalAppSecret: hasGlobalWaAppSecret,
        hasTenantAppSecret: hasTenantWaAppSecret,
        signatureReady: hasGlobalWaAppSecret || hasTenantWaAppSecret,
      },
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:settings");
    assertCan(ctx, "user:manage");
    const json = await req.json();
    const body = patchSchema.parse(json);

    if (body.woocommerce_webhook_secret !== undefined) {
      const secret = normalizeSecret(body.woocommerce_webhook_secret);
      if (secret) {
        await assertTenantCanUseIntegration(ctx.tenantId, "woocommerce");
      }
      await setTenantWooCommerceWebhookSecret(ctx.tenantId, secret);
    }

    if (
      body.woocommerce_store_url !== undefined ||
      body.woocommerce_consumer_key !== undefined ||
      body.woocommerce_consumer_secret !== undefined
    ) {
      if (
        hasEnabledValue(body.woocommerce_store_url) ||
        hasEnabledValue(body.woocommerce_consumer_key) ||
        hasEnabledValue(body.woocommerce_consumer_secret)
      ) {
        await assertTenantCanUseIntegration(ctx.tenantId, "woocommerce");
      }
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
      if (hasEnabledValue(body.bosta_api_key)) {
        await assertTenantCanUseIntegration(ctx.tenantId, "bosta");
      }
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

    if (
      body.jnt_api_account !== undefined ||
      body.jnt_customer_code !== undefined ||
      body.jnt_password !== undefined ||
      body.jnt_digest_secret !== undefined ||
      body.jnt_base_url !== undefined ||
      body.jnt_environment !== undefined ||
      body.jnt_sender_name !== undefined ||
      body.jnt_sender_phone !== undefined ||
      body.jnt_sender_city !== undefined ||
      body.jnt_sender_area !== undefined ||
      body.jnt_sender_address !== undefined ||
      body.jnt_default_service_code !== undefined ||
      body.jnt_default_weight_kg !== undefined ||
      body.jnt_default_length_cm !== undefined ||
      body.jnt_default_width_cm !== undefined ||
      body.jnt_default_height_cm !== undefined ||
      body.jnt_package_description !== undefined
    ) {
      if (
        hasEnabledValue(body.jnt_api_account) ||
        hasEnabledValue(body.jnt_customer_code) ||
        hasEnabledValue(body.jnt_password) ||
        hasEnabledValue(body.jnt_digest_secret)
      ) {
        await assertTenantCanUseIntegration(ctx.tenantId, "jntEgypt");
      }
      await setTenantJntEgyptFields(ctx.tenantId, {
        apiAccount: body.jnt_api_account,
        customerCode: body.jnt_customer_code,
        password: body.jnt_password,
        digestSecret: body.jnt_digest_secret,
        baseUrl: body.jnt_base_url,
        environment: body.jnt_environment,
        senderName: body.jnt_sender_name,
        senderPhone: body.jnt_sender_phone,
        senderCity: body.jnt_sender_city,
        senderArea: body.jnt_sender_area,
        senderAddress: body.jnt_sender_address,
        defaultServiceCode: body.jnt_default_service_code,
        defaultWeightKg: body.jnt_default_weight_kg,
        defaultLengthCm: body.jnt_default_length_cm,
        defaultWidthCm: body.jnt_default_width_cm,
        defaultHeightCm: body.jnt_default_height_cm,
        packageDescription: body.jnt_package_description,
      });
    }

    if (
      body.fedex_client_id !== undefined ||
      body.fedex_client_secret !== undefined ||
      body.fedex_account_number !== undefined ||
      body.fedex_base_url !== undefined ||
      body.fedex_environment !== undefined ||
      body.fedex_shipper_name !== undefined ||
      body.fedex_shipper_phone !== undefined ||
      body.fedex_shipper_street !== undefined ||
      body.fedex_shipper_city !== undefined ||
      body.fedex_shipper_state !== undefined ||
      body.fedex_shipper_postal_code !== undefined ||
      body.fedex_shipper_country_code !== undefined ||
      body.fedex_default_service_type !== undefined ||
      body.fedex_default_packaging_type !== undefined ||
      body.fedex_default_weight_kg !== undefined ||
      body.fedex_default_length_cm !== undefined ||
      body.fedex_default_width_cm !== undefined ||
      body.fedex_default_height_cm !== undefined ||
      body.fedex_package_description !== undefined
    ) {
      if (
        hasEnabledValue(body.fedex_client_id) ||
        hasEnabledValue(body.fedex_client_secret) ||
        hasEnabledValue(body.fedex_account_number)
      ) {
        await assertTenantCanUseIntegration(ctx.tenantId, "fedex");
      }
      await setTenantFedExFields(ctx.tenantId, {
        clientId: body.fedex_client_id,
        clientSecret: body.fedex_client_secret,
        accountNumber: body.fedex_account_number,
        baseUrl: body.fedex_base_url,
        environment: body.fedex_environment,
        shipperName: body.fedex_shipper_name,
        shipperPhone: body.fedex_shipper_phone,
        shipperStreet: body.fedex_shipper_street,
        shipperCity: body.fedex_shipper_city,
        shipperStateOrProvinceCode: body.fedex_shipper_state,
        shipperPostalCode: body.fedex_shipper_postal_code,
        shipperCountryCode: body.fedex_shipper_country_code,
        defaultServiceType: body.fedex_default_service_type,
        defaultPackagingType: body.fedex_default_packaging_type,
        defaultWeightKg: body.fedex_default_weight_kg,
        defaultLengthCm: body.fedex_default_length_cm,
        defaultWidthCm: body.fedex_default_width_cm,
        defaultHeightCm: body.fedex_default_height_cm,
        packageDescription: body.fedex_package_description,
      });
    }

    if (
      body.storefront_order_webhook_secret !== undefined ||
      body.storefront_order_secret_header_name !== undefined
    ) {
      if (hasEnabledValue(body.storefront_order_webhook_secret)) {
        await assertTenantCanUseIntegration(ctx.tenantId, "storefrontOrders");
      }
      await setTenantStorefrontOrderFields(ctx.tenantId, {
        webhookSecret: body.storefront_order_webhook_secret,
        secretHeaderName: body.storefront_order_secret_header_name,
      });
    }

    if (
      body.whatsapp_verify_token !== undefined ||
      body.whatsapp_access_token !== undefined ||
      body.whatsapp_phone_number_id !== undefined ||
      body.whatsapp_business_account_id !== undefined ||
      body.whatsapp_app_secret !== undefined
    ) {
      if (
        hasEnabledValue(body.whatsapp_verify_token) ||
        hasEnabledValue(body.whatsapp_access_token) ||
        hasEnabledValue(body.whatsapp_phone_number_id) ||
        hasEnabledValue(body.whatsapp_business_account_id) ||
        hasEnabledValue(body.whatsapp_app_secret)
      ) {
        await assertTenantCanUseIntegration(ctx.tenantId, "whatsapp");
      }
      await setTenantWhatsAppCloudFields(ctx.tenantId, {
        verifyToken: body.whatsapp_verify_token,
        accessToken: body.whatsapp_access_token,
        phoneNumberId: body.whatsapp_phone_number_id,
        businessAccountId: body.whatsapp_business_account_id,
        appSecret: body.whatsapp_app_secret,
      });
    }

    const int = await getTenantIntegrations(ctx.tenantId);
    const wooConfigured =
      (await getTenantWooCommerceWebhookSecret(ctx.tenantId)) !== null;
    const storefrontOrderWebhook =
      await getTenantStorefrontOrderWebhookSettings(ctx.tenantId);
    const woo = int.woocommerce ?? {};
    const wooRestConfigured = Boolean(
      woo.storeUrl?.trim() &&
        woo.consumerKey?.trim() &&
        woo.consumerSecret?.trim(),
    );
    const b = int.bosta ?? {};
    const jnt = int.jntEgypt ?? {};
    const fedex = int.fedex ?? {};
    const wa = int.whatsapp ?? {};
    const waToken = wa.accessToken?.trim();
    const waAppSec = wa.appSecret?.trim();
    const patchServerEnv = getServerEnv();
    const hasGlobalWaAppSecret = Boolean(
      patchServerEnv.WHATSAPP_APP_SECRET?.trim(),
    );
    const hasTenantWaAppSecret = Boolean(waAppSec);

    return jsonOk({
      woocommerceWebhookSecretConfigured: wooConfigured,
      storefrontOrderWebhookSecretConfigured:
        storefrontOrderWebhook.webhookSecret !== null,
      storefrontOrderSecretHeaderName: storefrontOrderWebhook.secretHeaderName,
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
      jntApiAccountConfigured: Boolean(jnt.apiAccount?.trim()),
      jntCustomerCodeConfigured: Boolean(jnt.customerCode?.trim()),
      jntPasswordConfigured: Boolean(jnt.password?.trim()),
      jntDigestSecretConfigured: Boolean(jnt.digestSecret?.trim()),
      jntBaseUrl: jnt.baseUrl?.trim() || null,
      jntEnvironment: jnt.environment ?? "prod",
      jntSenderName: jnt.senderName?.trim() || null,
      jntSenderPhone: jnt.senderPhone?.trim() || null,
      jntSenderCity: jnt.senderCity?.trim() || null,
      jntSenderArea: jnt.senderArea?.trim() || null,
      jntSenderAddress: jnt.senderAddress?.trim() || null,
      jntDefaultServiceCode: jnt.defaultServiceCode?.trim() || null,
      jntDefaultWeightKg: jnt.defaultWeightKg?.trim() || null,
      jntDefaultLengthCm: jnt.defaultLengthCm?.trim() || null,
      jntDefaultWidthCm: jnt.defaultWidthCm?.trim() || null,
      jntDefaultHeightCm: jnt.defaultHeightCm?.trim() || null,
      jntPackageDescription: jnt.packageDescription?.trim() || null,
      fedexClientIdConfigured: Boolean(fedex.clientId?.trim()),
      fedexClientSecretConfigured: Boolean(fedex.clientSecret?.trim()),
      fedexAccountNumber: fedex.accountNumber?.trim() || null,
      fedexBaseUrl: fedex.baseUrl?.trim() || null,
      fedexEnvironment: fedex.environment ?? "prod",
      fedexShipperName: fedex.shipperName?.trim() || null,
      fedexShipperPhone: fedex.shipperPhone?.trim() || null,
      fedexShipperStreet: fedex.shipperStreet?.trim() || null,
      fedexShipperCity: fedex.shipperCity?.trim() || null,
      fedexShipperState: fedex.shipperStateOrProvinceCode?.trim() || null,
      fedexShipperPostalCode: fedex.shipperPostalCode?.trim() || null,
      fedexShipperCountryCode: fedex.shipperCountryCode?.trim() || null,
      fedexDefaultServiceType: fedex.defaultServiceType?.trim() || null,
      fedexDefaultPackagingType: fedex.defaultPackagingType?.trim() || null,
      fedexDefaultWeightKg: fedex.defaultWeightKg?.trim() || null,
      fedexDefaultLengthCm: fedex.defaultLengthCm?.trim() || null,
      fedexDefaultWidthCm: fedex.defaultWidthCm?.trim() || null,
      fedexDefaultHeightCm: fedex.defaultHeightCm?.trim() || null,
      fedexPackageDescription: fedex.packageDescription?.trim() || null,
      whatsappVerifyTokenConfigured: Boolean(wa.verifyToken?.trim()),
      whatsappPhoneNumberId: wa.phoneNumberId?.trim() || null,
      whatsappBusinessAccountId: wa.businessAccountId?.trim() || null,
      whatsappAccessTokenLast4: last4(waToken),
      whatsappAppSecretLast4: last4(waAppSec),
      whatsappSignatureDiagnostics: {
        hasGlobalAppSecret: hasGlobalWaAppSecret,
        hasTenantAppSecret: hasTenantWaAppSecret,
        signatureReady: hasGlobalWaAppSecret || hasTenantWaAppSecret,
      },
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
