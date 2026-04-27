import { randomBytes } from "crypto";
import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockCreateTenant,
  mockGetTenant,
  mockGetTenantBySlug,
  mockSetTenantOwner,
} from "@/lib/dev/mock-backend";
import { slugify } from "@/lib/string/slugify";
import type { Tenant } from "@/lib/types/models";

function duplicateTenantSlugError(slug: string) {
  const e = new Error("Company name is already registered") as Error & {
    status: number;
    slug: string;
  };
  e.status = 409;
  e.slug = slug;
  return e;
}

export async function getTenant(tenantId: string): Promise<Tenant | null> {
  if (isDevMockDataEnabled()) return mockGetTenant(tenantId);
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.tenants).doc(tenantId).get();
  if (!snap.exists) return null;
  return snap.data() as Tenant;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const normalizedSlug = slugify(slug);
  if (isDevMockDataEnabled()) return mockGetTenantBySlug(normalizedSlug);
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.tenants)
    .where("slug", "==", normalizedSlug)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data() as Tenant;
}

export async function resolveTenantByIdOrSlug(
  value: string,
): Promise<Tenant | null> {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const byId = await getTenant(trimmed);
  if (byId) return byId;
  return getTenantBySlug(trimmed);
}

/** Creates a tenant row; set owner via `setTenantOwner` after the admin user exists. */
export async function createTenantRecord(name: string): Promise<Tenant> {
  if (isDevMockDataEnabled()) return mockCreateTenant(name);
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const staffApiKey = randomBytes(32).toString("hex");
  const slug = slugify(name);

  if (await getTenantBySlug(slug)) {
    throw duplicateTenantSlugError(slug);
  }

  const tenant: Tenant = {
    id,
    name: name.trim(),
    slug,
    ownerUserId: "",
    staffApiKey,
    createdAt: now,
    updatedAt: now,
  };
  const batch = db.batch();
  batch.create(db.collection(COLLECTIONS.tenantSlugs).doc(slug), {
      slug,
      tenantId: id,
      createdAt: now,
  });
  batch.set(db.collection(COLLECTIONS.tenants).doc(id), tenant);
  try {
    await batch.commit();
  } catch {
    throw duplicateTenantSlugError(slug);
  }
  return tenant;
}

export async function setTenantOwner(
  tenantId: string,
  ownerUserId: string,
): Promise<void> {
  if (isDevMockDataEnabled()) {
    mockSetTenantOwner(tenantId, ownerUserId);
    return;
  }
  const db = getDb();
  const now = new Date().toISOString();
  await db
    .collection(COLLECTIONS.tenants)
    .doc(tenantId)
    .set({ ownerUserId, updatedAt: now }, { merge: true });
}
