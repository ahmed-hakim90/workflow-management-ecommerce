import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import type { Order, OrderStatus } from "@/lib/types/models";
import {
  emptyDashboardStageValues,
  emptyDashboardStages,
  isDashboardOrderStage,
  type DashboardOrderStageKey,
} from "@/lib/logic/dashboard-order-stages";

export interface TenantOrderStageRollup {
  tenantId: string;
  stages: Record<DashboardOrderStageKey, number>;
  /** Sum of `orderValueForStageRollup` for orders currently in each pipeline stage. */
  stageValues: Record<DashboardOrderStageKey, number>;
  updatedAt: string;
}

export function orderValueForStageRollup(o: Order): number {
  const t = o.payment?.total_amount;
  return typeof t === "number" && !Number.isNaN(t) ? t : 0;
}

/**
 * Merges legacy Firestore documents that only have `stages` (no `stageValues` yet).
 */
function normalizeRollupData(
  raw: unknown,
): Pick<TenantOrderStageRollup, "stages" | "stageValues"> {
  const d = raw as Partial<TenantOrderStageRollup> | undefined;
  return {
    stages: { ...emptyDashboardStages(), ...d?.stages },
    stageValues: { ...emptyDashboardStageValues(), ...d?.stageValues },
  };
}

/**
 * Incremental counters for dashboard order stages (avoids listing all orders per request).
 * Only {@link DASHBOARD_ORDER_STAGE_KEYS} are tracked; terminal statuses are not counted.
 */
export async function applyOrderStageRollupDelta(input: {
  tenantId: string;
  from: OrderStatus | null;
  to: OrderStatus | null;
  orderValue: number;
}) {
  const { tenantId, from, to, orderValue: rawValue } = input;
  const orderValue =
    typeof rawValue === "number" && !Number.isNaN(rawValue) ? rawValue : 0;
  if (from === null && to === null) return;
  if (from !== null && to !== null && from === to) return;

  const db = getDb();
  const ref = db.collection(COLLECTIONS.tenantOrderStageRollup).doc(tenantId);
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const { stages: s0, stageValues: v0 } = snap.exists
      ? normalizeRollupData(snap.data())
      : { stages: emptyDashboardStages(), stageValues: emptyDashboardStageValues() };
    const stages = { ...s0 };
    const stageValues = { ...v0 };

    if (from && isDashboardOrderStage(from)) {
      stages[from] = Math.max(0, (stages[from] ?? 0) - 1);
      stageValues[from] = Math.max(0, (stageValues[from] ?? 0) - orderValue);
    }
    if (to && isDashboardOrderStage(to)) {
      stages[to] = (stages[to] ?? 0) + 1;
      stageValues[to] = (stageValues[to] ?? 0) + orderValue;
    }

    const payload: TenantOrderStageRollup = {
      tenantId,
      stages,
      stageValues,
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
  const stageValues = emptyDashboardStageValues();
  for (const doc of snap.docs) {
    const o = doc.data() as Order;
    if (isDashboardOrderStage(o.status)) {
      stages[o.status] += 1;
      const v = orderValueForStageRollup(o);
      stageValues[o.status] += v;
    }
  }

  const now = new Date().toISOString();
  const ref = db.collection(COLLECTIONS.tenantOrderStageRollup).doc(tenantId);
  await ref.set({
    tenantId,
    stages,
    stageValues,
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
  const { stages, stageValues } = normalizeRollupData(snap.data());
  const d = snap.data() as Partial<TenantOrderStageRollup>;
  return {
    tenantId: d.tenantId ?? tenantId,
    stages,
    stageValues,
    updatedAt: d.updatedAt ?? new Date().toISOString(),
  };
}
