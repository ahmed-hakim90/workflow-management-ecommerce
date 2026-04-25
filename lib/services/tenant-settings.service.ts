import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockGetTenantAutomationStore,
  mockSetTenantAutomation,
} from "@/lib/dev/mock-backend";
import {
  defaultTenantAutomation,
  type TenantAutomationSettings,
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
