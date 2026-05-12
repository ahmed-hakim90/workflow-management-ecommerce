import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { getServerEnv } from "@/lib/config/env";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockGetTenantAutomationStore,
  mockGetTenantIntegrations,
  mockSetTenantAutomation,
  mockSetTenantBostaFields,
  mockSetTenantFedExFields,
  mockSetTenantJntEgyptFields,
  mockSetTenantWhatsAppCloudFields,
  mockSetTenantStorefrontOrderFields,
  mockSetTenantWooCommerceRestFields,
  mockSetTenantWooCommerceWebhookSecret,
} from "@/lib/dev/mock-backend";
import {
  defaultTenantAutomation,
  defaultTenantWarehouse,
  type TenantAutomationSettings,
  type TenantFedExIntegration,
  type TenantIntegrationsDoc,
  type TenantJntEgyptIntegration,
  type TenantOutboundWebhook,
  type TenantStorefrontOrdersIntegration,
  type TenantWarehouseSettings,
  type TenantWhatsAppCloudIntegration,
} from "@/lib/types/models";

type TenantSettingsRow = {
  integrations?: TenantIntegrationsDoc | null;
  automation?: TenantAutomationSettings | null;
  kanban?: Record<string, unknown> | null;
};

async function getTenantSettingsRow(tenantId: string): Promise<TenantSettingsRow> {
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("tenant_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? {}) as TenantSettingsRow;
}

async function upsertTenantSettings(
  tenantId: string,
  patch: Partial<TenantSettingsRow>,
) {
  const { error } = await getSupabaseServiceRoleClient()
    .from("tenant_settings")
    .upsert({ tenant_id: tenantId, ...patch });
  if (error) throw error;
}

/** Stored `automation` in Supabase / mock — no legacy `integrations.warehouse` merge. */
export async function getRawTenantAutomationStored(
  tenantId: string,
): Promise<TenantAutomationSettings> {
  if (isDevMockDataEnabled()) {
    return {
      ...defaultTenantAutomation,
      ...mockGetTenantAutomationStore(tenantId),
    };
  }
  const data = await getTenantSettingsRow(tenantId);
  return { ...defaultTenantAutomation, ...(data?.automation ?? {}) };
}

/**
 * تضمين مؤقت: إن وُجد قالب قديم في `integrations.warehouse` ولم يُنقل لـ`automation`، نعرضه هنا.
 */
export async function getTenantAutomation(
  tenantId: string,
): Promise<TenantAutomationSettings> {
  if (isDevMockDataEnabled()) {
    const base = await getRawTenantAutomationStored(tenantId);
    if (!base.whatsappMessageTemplate?.trim()) {
      const legacy = mockGetTenantIntegrations(
        tenantId,
      ).warehouse?.whatsappMessageTemplate?.trim();
      if (legacy) {
        return { ...base, whatsappMessageTemplate: legacy };
      }
    }
    return base;
  }
  const base = await getRawTenantAutomationStored(tenantId);
  if (base.whatsappMessageTemplate?.trim()) return base;
  const int = await getTenantIntegrations(tenantId);
  const legacy = int.warehouse?.whatsappMessageTemplate?.trim();
  if (legacy) {
    return { ...base, whatsappMessageTemplate: legacy };
  }
  return base;
}

type TenantAutomationPatch = Partial<
  Omit<
    TenantAutomationSettings,
    | "whatsappMessageTemplate"
    | "orderLinkTemplate"
    | "outboundWebhooks"
    | "n8nWebhookUrl"
    | "n8nWebhookSecret"
    | "orderConfirmationTemplateName"
    | "orderConfirmationTemplateLanguage"
  >
> & {
  whatsappMessageTemplate?: string | null;
  orderLinkTemplate?: string | null;
  outboundWebhooks?: TenantOutboundWebhook[];
  n8nWebhookUrl?: string | null;
  n8nWebhookSecret?: string | null;
  orderConfirmationTemplateName?: string | null;
  orderConfirmationTemplateLanguage?: string | null;
};

function normalizeOutboundWebhooks(
  webhooks: TenantOutboundWebhook[] | undefined,
): TenantOutboundWebhook[] | undefined {
  if (!webhooks) return undefined;
  return webhooks.map((w) => ({
    id: w.id,
    name: w.name.trim(),
    enabled: w.enabled,
    url: w.url.trim(),
    secret: w.secret?.trim() || undefined,
    statuses: [...w.statuses],
    includeOrderSnapshot: !!w.includeOrderSnapshot,
  }));
}

function mergeTenantAutomationPatch(
  current: TenantAutomationSettings,
  updates: TenantAutomationPatch,
): TenantAutomationSettings {
  const next: Record<string, unknown> = { ...current, ...updates };
  if ("whatsappMessageTemplate" in updates) {
    if (
      updates.whatsappMessageTemplate == null ||
      (typeof updates.whatsappMessageTemplate === "string" &&
        !updates.whatsappMessageTemplate.trim())
    ) {
      delete next.whatsappMessageTemplate;
    } else {
      next.whatsappMessageTemplate = updates.whatsappMessageTemplate.trim();
    }
  }
  if ("orderLinkTemplate" in updates) {
    if (
      updates.orderLinkTemplate == null ||
      (typeof updates.orderLinkTemplate === "string" &&
        !updates.orderLinkTemplate.trim())
    ) {
      delete next.orderLinkTemplate;
    } else {
      next.orderLinkTemplate = updates.orderLinkTemplate.trim();
    }
  }
  if ("outboundWebhooks" in updates) {
    next.outboundWebhooks = normalizeOutboundWebhooks(updates.outboundWebhooks);
  }
  if ("n8nWebhookUrl" in updates) {
    if (
      updates.n8nWebhookUrl == null ||
      (typeof updates.n8nWebhookUrl === "string" && !updates.n8nWebhookUrl.trim())
    ) {
      delete next.n8nWebhookUrl;
    } else {
      next.n8nWebhookUrl = updates.n8nWebhookUrl.trim();
    }
  }
  if ("n8nWebhookSecret" in updates) {
    if (
      updates.n8nWebhookSecret == null ||
      (typeof updates.n8nWebhookSecret === "string" &&
        !updates.n8nWebhookSecret.trim())
    ) {
      delete next.n8nWebhookSecret;
    } else {
      next.n8nWebhookSecret = updates.n8nWebhookSecret.trim();
    }
  }
  if ("orderConfirmationTemplateName" in updates) {
    if (
      updates.orderConfirmationTemplateName == null ||
      (typeof updates.orderConfirmationTemplateName === "string" &&
        !updates.orderConfirmationTemplateName.trim())
    ) {
      delete next.orderConfirmationTemplateName;
    } else {
      next.orderConfirmationTemplateName =
        updates.orderConfirmationTemplateName.trim();
    }
  }
  if ("orderConfirmationTemplateLanguage" in updates) {
    if (
      updates.orderConfirmationTemplateLanguage == null ||
      (typeof updates.orderConfirmationTemplateLanguage === "string" &&
        !updates.orderConfirmationTemplateLanguage.trim())
    ) {
      delete next.orderConfirmationTemplateLanguage;
    } else {
      next.orderConfirmationTemplateLanguage =
        updates.orderConfirmationTemplateLanguage.trim();
    }
  }
  return next as unknown as TenantAutomationSettings;
}

export async function setTenantAutomation(
  tenantId: string,
  updates: TenantAutomationPatch,
) {
  if (isDevMockDataEnabled()) {
    const current = await getRawTenantAutomationStored(tenantId);
    const final = mergeTenantAutomationPatch(current, updates);
    mockSetTenantAutomation(tenantId, final);
    return;
  }
  const current = await getRawTenantAutomationStored(tenantId);
  const final = mergeTenantAutomationPatch(current, updates);
  await upsertTenantSettings(tenantId, { automation: final });
}

export async function getTenantIntegrations(
  tenantId: string,
): Promise<TenantIntegrationsDoc> {
  if (isDevMockDataEnabled()) return mockGetTenantIntegrations(tenantId);
  const data = await getTenantSettingsRow(tenantId);
  return { ...(data?.integrations ?? {}) };
}

/**
 * Single read of `tenantSettings/{tenantId}` for flows that need both integrations
 * and automation (avoids duplicate document reads from `getTenantIntegrations` +
 * `getTenantAutomation` in parallel).
 */
export async function getTenantIntegrationsAndAutomationBundled(
  tenantId: string,
): Promise<{
  integrations: TenantIntegrationsDoc;
  automation: TenantAutomationSettings;
}> {
  if (isDevMockDataEnabled()) {
    const [integrations, automation] = await Promise.all([
      mockGetTenantIntegrations(tenantId),
      getTenantAutomation(tenantId),
    ]);
    return { integrations, automation };
  }
  const data = await getTenantSettingsRow(tenantId);
  const integrations = { ...(data?.integrations ?? {}) };
  let automation: TenantAutomationSettings = {
    ...defaultTenantAutomation,
    ...(data?.automation ?? {}),
  };
  if (!automation.whatsappMessageTemplate?.trim()) {
    const legacy = integrations.warehouse?.whatsappMessageTemplate?.trim();
    if (legacy) {
      automation = { ...automation, whatsappMessageTemplate: legacy };
    }
  }
  return { integrations, automation };
}

/** Returns trimmed secret or null if unset. */
export async function getTenantWooCommerceWebhookSecret(
  tenantId: string,
): Promise<string | null> {
  const doc = await getTenantIntegrations(tenantId);
  const s = doc.woocommerce?.webhookSecret?.trim();
  return s || null;
}

export async function getTenantWhatsAppCloud(
  tenantId: string,
): Promise<TenantWhatsAppCloudIntegration> {
  const doc = await getTenantIntegrations(tenantId);
  return { ...(doc.whatsapp ?? {}) };
}

export type TenantStorefrontOrderWebhookSettings = {
  webhookSecret: string | null;
  secretHeaderName: string;
};

export function normalizeSecretHeaderName(raw: string | null | undefined): string {
  const t = raw?.trim().toLowerCase();
  return t || "x-api-secret";
}

export async function getTenantStorefrontOrderWebhookSettings(
  tenantId: string,
): Promise<TenantStorefrontOrderWebhookSettings> {
  const doc = await getTenantIntegrations(tenantId);
  const s = doc.storefrontOrders?.webhookSecret?.trim();
  return {
    webhookSecret: s || null,
    secretHeaderName: normalizeSecretHeaderName(
      doc.storefrontOrders?.secretHeaderName,
    ),
  };
}

/** Bosta Node SDK uses `${base}/api/v0/...` — host only, no /api/v2 suffix. */
export function normalizeBostaBaseUrlForSdk(raw: string): string {
  let u = raw.trim().replace(/\/+$/, "");
  u = u.replace(/\/api\/v\d+$/i, "");
  if (!u) return "https://app.bosta.co";
  try {
    const parsed = new URL(u);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "https://app.bosta.co";
  }
}

/** Effective Bosta credentials: tenant overrides, then server env. */
export async function resolveBostaCredentials(tenantId: string): Promise<{
  apiKey: string | null;
  baseUrl: string;
}> {
  const doc = await getTenantIntegrations(tenantId);
  const env = getServerEnv();
  const apiKey =
    doc.bosta?.apiKey?.trim() || env.BOSTA_API_KEY?.trim() || null;
  const baseUrl = normalizeBostaBaseUrlForSdk(
    doc.bosta?.baseUrl?.trim() ||
      env.BOSTA_BASE_URL?.trim() ||
      "https://app.bosta.co",
  );
  return { apiKey, baseUrl };
}

export async function setTenantBostaFields(
  tenantId: string,
  fields: {
    apiKey?: string | null;
    baseUrl?: string | null;
    defaultCityId?: string | null;
    defaultZoneId?: string | null;
    defaultBuildingNumber?: string | null;
    defaultAddressLine?: string | null;
    packageDescription?: string | null;
  },
): Promise<void> {
  if (isDevMockDataEnabled()) {
    mockSetTenantBostaFields(tenantId, fields);
    return;
  }
  const data = await getTenantSettingsRow(tenantId);
  const integrations: TenantIntegrationsDoc = { ...(data?.integrations ?? {}) };
  const bosta = { ...(integrations.bosta ?? {}) };

  const apply = (key: keyof typeof bosta, val: string | null | undefined) => {
    if (val === undefined) return;
    if (val === null || val.trim() === "") {
      delete bosta[key];
    } else {
      (bosta as Record<string, string>)[key as string] = val.trim();
    }
  };

  apply("apiKey", fields.apiKey);
  apply("baseUrl", fields.baseUrl);
  apply("defaultCityId", fields.defaultCityId);
  apply("defaultZoneId", fields.defaultZoneId);
  apply("defaultBuildingNumber", fields.defaultBuildingNumber);
  apply("defaultAddressLine", fields.defaultAddressLine);
  apply("packageDescription", fields.packageDescription);

  if (Object.keys(bosta).length === 0) {
    delete integrations.bosta;
  } else {
    integrations.bosta = bosta;
  }
  await upsertTenantSettings(tenantId, { integrations });
}

function applyStringPatch(
  target: Record<string, string | undefined>,
  fields: Record<string, string | null | undefined>,
) {
  for (const [key, val] of Object.entries(fields)) {
    if (val === undefined) continue;
    if (val === null || val.trim() === "") {
      delete target[key];
    } else {
      target[key] = val.trim();
    }
  }
}

export async function setTenantJntEgyptFields(
  tenantId: string,
  fields: {
    [K in keyof TenantJntEgyptIntegration]?: TenantJntEgyptIntegration[K] | null;
  },
): Promise<void> {
  if (isDevMockDataEnabled()) {
    mockSetTenantJntEgyptFields(tenantId, fields);
    return;
  }
  const data = await getTenantSettingsRow(tenantId);
  const integrations: TenantIntegrationsDoc = { ...(data?.integrations ?? {}) };
  const jntEgypt: TenantJntEgyptIntegration = {
    ...(integrations.jntEgypt ?? {}),
  };
  applyStringPatch(
    jntEgypt as Record<string, string | undefined>,
    fields as Record<string, string | null | undefined>,
  );
  if (Object.keys(jntEgypt).length === 0) {
    delete integrations.jntEgypt;
  } else {
    integrations.jntEgypt = jntEgypt;
  }
  await upsertTenantSettings(tenantId, { integrations });
}

export async function setTenantFedExFields(
  tenantId: string,
  fields: {
    [K in keyof TenantFedExIntegration]?: TenantFedExIntegration[K] | null;
  },
): Promise<void> {
  if (isDevMockDataEnabled()) {
    mockSetTenantFedExFields(tenantId, fields);
    return;
  }
  const data = await getTenantSettingsRow(tenantId);
  const integrations: TenantIntegrationsDoc = { ...(data?.integrations ?? {}) };
  const fedex: TenantFedExIntegration = {
    ...(integrations.fedex ?? {}),
  };
  applyStringPatch(
    fedex as Record<string, string | undefined>,
    fields as Record<string, string | null | undefined>,
  );
  if (Object.keys(fedex).length === 0) {
    delete integrations.fedex;
  } else {
    integrations.fedex = fedex;
  }
  await upsertTenantSettings(tenantId, { integrations });
}

export async function resolveJntEgyptCredentials(tenantId: string): Promise<{
  apiAccount: string | null;
  customerCode: string | null;
  customerPassword: string | null;
  privateKey: string | null;
  baseUrl: string;
  settings: TenantJntEgyptIntegration;
}> {
  const doc = await getTenantIntegrations(tenantId);
  const env = getServerEnv();
  const settings = doc.jntEgypt ?? {};
  const environment = settings.environment ?? "prod";
  const fallbackBase =
    environment === "test"
      ? "https://demoopenapi.jtjms-eg.com"
      : "https://openapi.jtjms-eg.com";
  return {
    apiAccount:
      settings.apiAccount?.trim() ||
      env.JNT_EGYPT_API_ACCOUNT?.trim() ||
      settings.customerCode?.trim() ||
      env.JNT_EGYPT_CUSTOMER_CODE?.trim() ||
      null,
    customerCode:
      settings.customerCode?.trim() ||
      env.JNT_EGYPT_CUSTOMER_CODE?.trim() ||
      null,
    customerPassword:
      settings.password?.trim() ||
      env.JNT_EGYPT_PASSWORD?.trim() ||
      null,
    privateKey:
      settings.digestSecret?.trim() ||
      env.JNT_EGYPT_DIGEST_SECRET?.trim() ||
      null,
    baseUrl: normalizeBostaBaseUrlForSdk(
      settings.baseUrl?.trim() ||
        env.JNT_EGYPT_BASE_URL?.trim() ||
        fallbackBase,
    ),
    settings,
  };
}

export async function resolveFedExCredentials(tenantId: string): Promise<{
  clientId: string | null;
  clientSecret: string | null;
  accountNumber: string | null;
  baseUrl: string;
  settings: TenantFedExIntegration;
}> {
  const doc = await getTenantIntegrations(tenantId);
  const env = getServerEnv();
  const settings = doc.fedex ?? {};
  const environment = settings.environment ?? "prod";
  const fallbackBase =
    environment === "test"
      ? "https://apis-sandbox.fedex.com"
      : "https://apis.fedex.com";
  return {
    clientId: settings.clientId?.trim() || env.FEDEX_CLIENT_ID?.trim() || null,
    clientSecret:
      settings.clientSecret?.trim() ||
      env.FEDEX_CLIENT_SECRET?.trim() ||
      null,
    accountNumber:
      settings.accountNumber?.trim() ||
      env.FEDEX_ACCOUNT_NUMBER?.trim() ||
      null,
    baseUrl: normalizeBostaBaseUrlForSdk(
      settings.baseUrl?.trim() || env.FEDEX_BASE_URL?.trim() || fallbackBase,
    ),
    settings,
  };
}

export async function setTenantWhatsAppCloudFields(
  tenantId: string,
  fields: {
    verifyToken?: string | null;
    accessToken?: string | null;
    phoneNumberId?: string | null;
    businessAccountId?: string | null;
    appSecret?: string | null;
  },
): Promise<void> {
  if (isDevMockDataEnabled()) {
    mockSetTenantWhatsAppCloudFields(tenantId, fields);
    return;
  }
  const data = await getTenantSettingsRow(tenantId);
  const integrations: TenantIntegrationsDoc = { ...(data?.integrations ?? {}) };
  const whatsapp: TenantWhatsAppCloudIntegration = {
    ...(integrations.whatsapp ?? {}),
  };

  const apply = (
    key: keyof TenantWhatsAppCloudIntegration,
    val: string | null | undefined,
  ) => {
    if (val === undefined) return;
    if (val === null || val.trim() === "") {
      delete whatsapp[key];
    } else {
      (whatsapp as Record<string, string>)[key as string] = val.trim();
    }
  };

  apply("verifyToken", fields.verifyToken);
  apply("accessToken", fields.accessToken);
  apply("phoneNumberId", fields.phoneNumberId);
  apply("businessAccountId", fields.businessAccountId);
  apply("appSecret", fields.appSecret);

  if (Object.keys(whatsapp).length === 0) {
    delete integrations.whatsapp;
  } else {
    integrations.whatsapp = whatsapp;
  }
  await upsertTenantSettings(tenantId, { integrations });
}

export async function setTenantStorefrontOrderFields(
  tenantId: string,
  fields: {
    webhookSecret?: string | null;
    secretHeaderName?: string | null;
  },
): Promise<void> {
  const normalizedHeader =
    fields.secretHeaderName === undefined
      ? undefined
      : normalizeSecretHeaderName(fields.secretHeaderName);
  if (isDevMockDataEnabled()) {
    mockSetTenantStorefrontOrderFields(tenantId, {
      webhookSecret: fields.webhookSecret,
      secretHeaderName: normalizedHeader,
    });
    return;
  }
  const data = await getTenantSettingsRow(tenantId);
  const integrations: TenantIntegrationsDoc = { ...(data?.integrations ?? {}) };
  const storefrontOrders: TenantStorefrontOrdersIntegration = {
    ...(integrations.storefrontOrders ?? {}),
  };

  const apply = (
    key: keyof TenantStorefrontOrdersIntegration,
    val: string | null | undefined,
  ) => {
    if (val === undefined) return;
    if (val === null || val.trim() === "") {
      delete storefrontOrders[key];
    } else {
      storefrontOrders[key] = val.trim();
    }
  };

  apply("webhookSecret", fields.webhookSecret);
  apply("secretHeaderName", normalizedHeader);

  if (Object.keys(storefrontOrders).length === 0) {
    delete integrations.storefrontOrders;
  } else {
    integrations.storefrontOrders = storefrontOrders;
  }
  await upsertTenantSettings(tenantId, { integrations });
}

export async function setTenantWooCommerceWebhookSecret(
  tenantId: string,
  secret: string | null,
): Promise<void> {
  if (isDevMockDataEnabled()) {
    mockSetTenantWooCommerceWebhookSecret(tenantId, secret);
    return;
  }
  const data = await getTenantSettingsRow(tenantId);
  const integrations: TenantIntegrationsDoc = { ...(data?.integrations ?? {}) };
  const woo = { ...(integrations.woocommerce ?? {}) };
  if (secret === null || secret.trim() === "") {
    delete woo.webhookSecret;
  } else {
    woo.webhookSecret = secret.trim();
  }
  if (Object.keys(woo).length === 0) {
    delete integrations.woocommerce;
  } else {
    integrations.woocommerce = woo;
  }
  await upsertTenantSettings(tenantId, { integrations });
}

export async function setTenantWooCommerceRestFields(
  tenantId: string,
  fields: {
    storeUrl?: string | null;
    consumerKey?: string | null;
    consumerSecret?: string | null;
  },
): Promise<void> {
  if (isDevMockDataEnabled()) {
    mockSetTenantWooCommerceRestFields(tenantId, fields);
    return;
  }
  const data = await getTenantSettingsRow(tenantId);
  const integrations: TenantIntegrationsDoc = { ...(data?.integrations ?? {}) };
  const woo = { ...(integrations.woocommerce ?? {}) };

  const apply = (
    key: "storeUrl" | "consumerKey" | "consumerSecret",
    val: string | null | undefined,
  ) => {
    if (val === undefined) return;
    if (val === null || val.trim() === "") {
      delete woo[key];
    } else {
      woo[key] = val.trim();
    }
  };
  apply("storeUrl", fields.storeUrl);
  apply("consumerKey", fields.consumerKey);
  apply("consumerSecret", fields.consumerSecret);

  if (Object.keys(woo).length === 0) {
    delete integrations.woocommerce;
  } else {
    integrations.woocommerce = woo;
  }
  await upsertTenantSettings(tenantId, { integrations });
}

export type EffectiveWarehouseSettings = {
  singleScanFulfills: boolean;
  scanCooldownMs: number;
};

export async function getWarehouseSettings(
  tenantId: string,
): Promise<EffectiveWarehouseSettings> {
  const int = await getTenantIntegrations(tenantId);
  return resolveWarehouseFromDoc(int.warehouse);
}

function resolveWarehouseFromDoc(
  w: import("@/lib/types/models").TenantWarehouseSettings | undefined,
): EffectiveWarehouseSettings {
  return {
    singleScanFulfills: w?.singleScanFulfills ?? false,
    scanCooldownMs: Math.max(
      0,
      w?.scanCooldownMs ?? defaultTenantWarehouse.scanCooldownMs,
    ),
  };
}

export async function setTenantWarehouseSettings(
  tenantId: string,
  fields: {
    singleScanFulfills?: boolean;
    scanCooldownMs?: number | null;
  },
) {
  if (isDevMockDataEnabled()) {
    const { mockSetTenantWarehouse } = await import("@/lib/dev/mock-backend");
    mockSetTenantWarehouse(tenantId, fields);
    return;
  }
  const data = await getTenantSettingsRow(tenantId);
  const integrations: TenantIntegrationsDoc = { ...(data?.integrations ?? {}) };
  const prev: TenantWarehouseSettings = { ...(integrations.warehouse ?? {}) };

  if (fields.singleScanFulfills !== undefined) {
    if (fields.singleScanFulfills) prev.singleScanFulfills = true;
    else delete prev.singleScanFulfills;
  }
  if (fields.scanCooldownMs !== undefined) {
    if (fields.scanCooldownMs === null) {
      delete prev.scanCooldownMs;
    } else {
      prev.scanCooldownMs = fields.scanCooldownMs;
    }
  }
  if (Object.keys(prev).length === 0) {
    delete integrations.warehouse;
  } else {
    integrations.warehouse = prev;
  }
  await upsertTenantSettings(tenantId, { integrations });
}
