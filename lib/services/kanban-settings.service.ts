import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockGetKanbanSettings,
  mockSetKanbanSettings,
} from "@/lib/dev/mock-backend";
import { mergeKanbanSettings } from "@/lib/kanban/column";
import type { TenantKanbanSettings } from "@/lib/types/models";

export async function getKanbanSettings(
  tenantId: string,
): Promise<TenantKanbanSettings> {
  if (isDevMockDataEnabled()) {
    return mergeKanbanSettings(mockGetKanbanSettings(tenantId));
  }
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.tenantSettings).doc(tenantId).get();
  const data = snap.data() as { kanban?: TenantKanbanSettings } | undefined;
  return mergeKanbanSettings(data?.kanban ?? null);
}

export async function setKanbanSettings(
  tenantId: string,
  kanban: TenantKanbanSettings,
) {
  const merged = mergeKanbanSettings(kanban);
  if (isDevMockDataEnabled()) {
    mockSetKanbanSettings(tenantId, merged);
    return;
  }
  const db = getDb();
  await db
    .collection(COLLECTIONS.tenantSettings)
    .doc(tenantId)
    .set({ kanban: merged, updatedAt: new Date().toISOString() }, { merge: true });
}
