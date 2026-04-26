import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { getServerEnv } from "@/lib/config/env";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockGetTenantAutomationStore,
  mockGetTenantIntegrations,
  mockSetTenantAutomation,
  mockSetTenantBostaFields,
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

const DEFAULT_BOSTA_BASE = "https://app.bosta.co/api/v2";

/** Effective Bosta credentials: tenant overrides, then server env. */
export async function resolveBostaCredentials(tenantId: string): Promise<{
  apiKey: string | null;
  baseUrl: string;
}> {
  const doc = await getTenantIntegrations(tenantId);
  const env = getServerEnv();
  const apiKey =
    doc.bosta?.apiKey?.trim() || env.BOSTA_API_KEY?.trim() || null;
  const baseUrl =
    doc.bosta?.baseUrl?.trim() ||
    env.BOSTA_BASE_URL?.trim() ||
    DEFAULT_BOSTA_BASE;
  return { apiKey, baseUrl };
}

export async function setTenantBostaFields(
  tenantId: string,
  fields: { apiKey?: string | null; baseUrl?: string | null },
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
  if (fields.apiKey !== undefined) {
    if (fields.apiKey === null || fields.apiKey.trim() === "") {
      delete bosta.apiKey;
    } else {
      bosta.apiKey = fields.apiKey.trim();
    }
  }
  if (fields.baseUrl !== undefined) {
    if (fields.baseUrl === null || fields.baseUrl.trim() === "") {
      delete bosta.baseUrl;
    } else {
      bosta.baseUrl = fields.baseUrl.trim();
    }
  }
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
