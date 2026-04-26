import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { getServerEnv } from "@/lib/config/env";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockGetTenantAutomationStore,
  mockGetTenantIntegrations,
  mockSetTenantAutomation,
  mockSetTenantBostaFields,
  mockSetTenantWooCommerceRestFields,
  mockSetTenantWooCommerceWebhookSecret,
} from "@/lib/dev/mock-backend";
import {
  defaultTenantAutomation,
  type TenantAutomationSettings,
  type TenantIntegrationsDoc,
} from "@/lib/types/models";

export async function getTenantAutomation(
  tenantId: string,
): Promise<TenantAutomationSettings> {
  if (isDevMockDataEnabled()) return mockGetTenantAutomationStore(tenantId);
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.tenantSettings)
    .doc(tenantId)
    .get();
  const data = snap.data() as { automation?: TenantAutomationSettings } | undefined;
  return { ...defaultTenantAutomation, ...(data?.automation ?? {}) };
}

export async function setTenantAutomation(
  tenantId: string,
  automation: TenantAutomationSettings,
) {
  if (isDevMockDataEnabled()) {
    mockSetTenantAutomation(tenantId, automation);
    return;
  }
  const db = getDb();
  await db
    .collection(COLLECTIONS.tenantSettings)
    .doc(tenantId)
    .set({ automation, updatedAt: new Date().toISOString() }, { merge: true });
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
