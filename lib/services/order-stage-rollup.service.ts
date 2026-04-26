import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import type { Order, OrderStatus } from "@/lib/types/models";
import {
  emptyDashboardStages,
  isDashboardOrderStage,
  type DashboardOrderStageKey,
} from "@/lib/logic/dashboard-order-stages";

export interface TenantOrderStageRollup {
  tenantId: string;
  stages: Record<DashboardOrderStageKey, number>;
  updatedAt: string;
}

/**
 * Incremental counters for dashboard order stages (avoids listing all orders per request).
 * Only {@link DASHBOARD_ORDER_STAGE_KEYS} are tracked; terminal statuses are not counted.
 */
export async function applyOrderStageRollupDelta(input: {
  tenantId: string;
  from: OrderStatus | null;
  to: OrderStatus | null;
}) {
  const { tenantId, from, to } = input;
  if (from === null && to === null) return;
  if (from !== null && to !== null && from === to) return;

  const db = getDb();
  const ref = db.collection(COLLECTIONS.tenantOrderStageRollup).doc(tenantId);
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const stages: Record<DashboardOrderStageKey, number> = snap.exists
      ? { ...emptyDashboardStages(), ...(snap.data() as TenantOrderStageRollup).stages }
      : emptyDashboardStages();

    if (from && isDashboardOrderStage(from)) {
      stages[from] = Math.max(0, (stages[from] ?? 0) - 1);
    }
    if (to && isDashboardOrderStage(to)) {
      stages[to] = (stages[to] ?? 0) + 1;
    }

    const payload: TenantOrderStageRollup = {
      tenantId,
      stages,
      updatedAt: now,
    };
    tx.set(ref, payload);
  });
}

/** Full recompute when rollup doc is missing (e.g. first deploy). */
export async function rebuildTenantOrderStageRollup(tenantId: string) {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.orders)
    .where("tenantId", "==", tenantId)
    .limit(5000)
    .get();

  const stages = emptyDashboardStages();
  for (const doc of snap.docs) {
    const o = doc.data() as Order;
    if (isDashboardOrderStage(o.status)) {
      stages[o.status] += 1;
    }
  }

  const now = new Date().toISOString();
  const ref = db.collection(COLLECTIONS.tenantOrderStageRollup).doc(tenantId);
  await ref.set({
    tenantId,
    stages,
    updatedAt: now,
  } satisfies TenantOrderStageRollup);
}

export async function getTenantOrderStageRollup(
  tenantId: string,
): Promise<TenantOrderStageRollup | null> {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.tenantOrderStageRollup)
    .doc(tenantId)
    .get();
  if (!snap.exists) return null;
  return snap.data() as TenantOrderStageRollup;
}
