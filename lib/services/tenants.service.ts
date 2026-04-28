import { randomBytes } from "crypto";
import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockCreateTenant,
  mockGetTenant,
  mockGetTenantBySlug,
  mockListTenants,
  mockSetTenantOwner,
  mockSetTenantStatus,
} from "@/lib/dev/mock-backend";
import { slugify } from "@/lib/string/slugify";
import type { Tenant, TenantStatus } from "@/lib/types/models";
import { omitUndefinedForFirestore } from "@/lib/util/json-snapshot";

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

export async function listTenants(): Promise<Tenant[]> {
  if (isDevMockDataEnabled()) return mockListTenants();
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.tenants)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => d.data() as Tenant);
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

export async function setTenantStatus(input: {
  tenantId: string;
  status: TenantStatus;
  reason?: string | null;
}): Promise<Tenant> {
  if (isDevMockDataEnabled()) return mockSetTenantStatus(input);
  const db = getDb();
  const ref = db.collection(COLLECTIONS.tenants).doc(input.tenantId);
  const snap = await ref.get();
  const tenant = snap.data() as Tenant | undefined;
  if (!tenant) {
    const e = new Error("Tenant not found") as Error & { status: number };
    e.status = 404;
    throw e;
  }
  const now = new Date().toISOString();
  const next: Tenant = {
    ...tenant,
    status: input.status,
    suspendedAt: input.status === "suspended" ? now : undefined,
    suspendedReason:
      input.status === "suspended" ? input.reason?.trim() || undefined : undefined,
    updatedAt: now,
  };
  await ref.set(omitUndefinedForFirestore(next));
  return next;
}
