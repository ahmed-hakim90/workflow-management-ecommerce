import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { getServerEnv } from "@/lib/config/env";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockGetTenantAutomationStore,
  mockGetTenantIntegrations,
  mockSetTenantAutomation,
  mockSetTenantBostaFields,
  mockSetTenantStorefrontOrderFields,
  mockSetTenantWooCommerceRestFields,
  mockSetTenantWooCommerceWebhookSecret,
} from "@/lib/dev/mock-backend";
import {
  defaultTenantAutomation,
  defaultTenantWarehouse,
  type TenantAutomationSettings,
  type TenantIntegrationsDoc,
  type TenantStorefrontOrdersIntegration,
  type TenantWarehouseSettings,
} from "@/lib/types/models";

/** Stored `automation` in Firestore / mock — no legacy `integrations.warehouse` merge. */
export async function getRawTenantAutomationStored(
  tenantId: string,
): Promise<TenantAutomationSettings> {
  if (isDevMockDataEnabled()) {
    return {
      ...defaultTenantAutomation,
      ...mockGetTenantAutomationStore(tenantId),
    };
  }
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.tenantSettings)
    .doc(tenantId)
    .get();
  const data = snap.data() as { automation?: TenantAutomationSettings } | undefined;
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
  Omit<TenantAutomationSettings, "whatsappMessageTemplate">
> & {
  whatsappMessageTemplate?: string | null;
};

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
  const db = getDb();
  const current = await getRawTenantAutomationStored(tenantId);
  const final = mergeTenantAutomationPatch(current, updates);
  await db
    .collection(COLLECTIONS.tenantSettings)
    .doc(tenantId)
    .set(
      { automation: final, updatedAt: new Date().toISOString() },
      { merge: true },
    );
}

export async function getTenantIntegrations(
  tenantId: string,
): Promise<TenantIntegrationsDoc> {
  if (isDevMockDataEnabled()) return mockGetTenantIntegrations(tenantId);
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.tenantSettings)
    .doc(tenantId)
    .get();
  const data = snap.data() as
    | { integrations?: TenantIntegrationsDoc }
    | undefined;
  return { ...(data?.integrations ?? {}) };
}

/** Returns trimmed secret or null if unset. */
export async function getTenantWooCommerceWebhookSecret(
  tenantId: string,
): Promise<string | null> {
  const doc = await getTenantIntegrations(tenantId);
  const s = doc.woocommerce?.webhookSecret?.trim();
  return s || null;
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
  const db = getDb();
  const ref = db.collection(COLLECTIONS.tenantSettings).doc(tenantId);
  const snap = await ref.get();
  const data = snap.data() as
    | { integrations?: TenantIntegrationsDoc }
    | undefined;
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
  await ref.set(
    {
      integrations,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
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
  const db = getDb();
  const ref = db.collection(COLLECTIONS.tenantSettings).doc(tenantId);
  const snap = await ref.get();
  const data = snap.data() as
    | { integrations?: TenantIntegrationsDoc }
    | undefined;
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
  await ref.set(
    {
      integrations,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function setTenantWooCommerceWebhookSecret(
  tenantId: string,
  secret: string | null,
): Promise<void> {
  if (isDevMockDataEnabled()) {
    mockSetTenantWooCommerceWebhookSecret(tenantId, secret);
    return;
  }
  const db = getDb();
  const ref = db.collection(COLLECTIONS.tenantSettings).doc(tenantId);
  const snap = await ref.get();
  const data = snap.data() as
    | { integrations?: TenantIntegrationsDoc }
    | undefined;
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
  await ref.set(
    {
      integrations,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
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
  const db = getDb();
  const ref = db.collection(COLLECTIONS.tenantSettings).doc(tenantId);
  const snap = await ref.get();
  const data = snap.data() as
    | { integrations?: TenantIntegrationsDoc }
    | undefined;
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
  await ref.set(
    {
      integrations,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
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
  const db = getDb();
  const ref = db.collection(COLLECTIONS.tenantSettings).doc(tenantId);
  const snap = await ref.get();
  const data = snap.data() as
    | { integrations?: TenantIntegrationsDoc }
    | undefined;
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
  await ref.set(
    {
      integrations,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}
