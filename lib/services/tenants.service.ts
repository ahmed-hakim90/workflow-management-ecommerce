import { randomBytes } from "crypto";
import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockCreateTenant,
  mockGetTenant,
  mockSetTenantOwner,
} from "@/lib/dev/mock-backend";
import { slugify } from "@/lib/string/slugify";
import type { Tenant } from "@/lib/types/models";

export async function getTenant(tenantId: string): Promise<Tenant | null> {
  if (isDevMockDataEnabled()) return mockGetTenant(tenantId);
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.tenants).doc(tenantId).get();
  if (!snap.exists) return null;
  return snap.data() as Tenant;
}

/** Creates a tenant row; set owner via `setTenantOwner` after the admin user exists. */
export async function createTenantRecord(name: string): Promise<Tenant> {
  if (isDevMockDataEnabled()) return mockCreateTenant(name);
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const staffApiKey = randomBytes(32).toString("hex");
  const tenant: Tenant = {
    id,
    name: name.trim(),
    slug: `${slugify(name)}-${id.slice(0, 8)}`,
    ownerUserId: "",
    staffApiKey,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTIONS.tenants).doc(id).set(tenant);
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
