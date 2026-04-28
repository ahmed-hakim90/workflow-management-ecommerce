import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import type { UserStats } from "@/lib/types/models";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import { mockGetUserStatsForToday } from "@/lib/dev/mock-backend";
import { listOrders } from "@/lib/services/orders.service";
import {
  getTenantOrderStageRollup,
  orderValueForStageRollup,
} from "@/lib/services/order-stage-rollup.service";
import { DASHBOARD_ORDER_STAGE_KEYS } from "@/lib/logic/dashboard-order-stages";

const KANBAN_STATUSES = [...DASHBOARD_ORDER_STAGE_KEYS] as const;

type KanbanStageKey = (typeof KANBAN_STATUSES)[number];

const KANBAN_STATUS_SET = new Set<string>(KANBAN_STATUSES);

/** Counts (and `warehouse` roll-up) plus matching `stageValues` (pipeline monetary totals). */
export type OrdersPerStageResult = {
  [K in KanbanStageKey | "warehouse"]: number;
} & {
  stageValues: { [K in KanbanStageKey | "warehouse"]: number };
};

const ZERO_SIX = (): { [K in KanbanStageKey]: number } => ({
  pending_confirmation: 0,
  confirmed: 0,
  invoicing: 0,
  ready_for_warehouse: 0,
  packed: 0,
  shipped: 0,
});

function perStageValueTotals(
  v: { [K in KanbanStageKey]: number },
): OrdersPerStageResult["stageValues"] {
  return {
    ...v,
    warehouse: v.ready_for_warehouse + v.packed,
  };
}

const ZERO_STAGE: OrdersPerStageResult = (() => {
  const z = ZERO_SIX();
  return {
    ...z,
    warehouse: 0,
    stageValues: perStageValueTotals(z),
  };
})();

export async function getOrdersPerStage(
  tenantId: string,
): Promise<OrdersPerStageResult> {
  if (isDevMockDataEnabled()) {
    const orders = await listOrders(tenantId);
    const counts = ZERO_SIX();
    const amounts = ZERO_SIX();
    for (const o of orders) {
      if (KANBAN_STATUS_SET.has(o.status)) {
        const b = o.status as KanbanStageKey;
        counts[b] += 1;
        amounts[b] += orderValueForStageRollup(o);
      }
    }
    return {
      ...counts,
      warehouse: counts.ready_for_warehouse + counts.packed,
      stageValues: perStageValueTotals(amounts),
    };
  }

  const rollup = await getTenantOrderStageRollup(tenantId);

  if (!rollup?.stages) {
    return ZERO_STAGE;
  }

  const { stages, stageValues: sv0 } = rollup;
  const amt: { [K in KanbanStageKey]: number } = {
    pending_confirmation: sv0.pending_confirmation ?? 0,
    confirmed: sv0.confirmed ?? 0,
    invoicing: sv0.invoicing ?? 0,
    ready_for_warehouse: sv0.ready_for_warehouse ?? 0,
    packed: sv0.packed ?? 0,
    shipped: sv0.shipped ?? 0,
  };
  return {
    pending_confirmation: stages.pending_confirmation ?? 0,
    confirmed: stages.confirmed ?? 0,
    invoicing: stages.invoicing ?? 0,
    ready_for_warehouse: stages.ready_for_warehouse ?? 0,
    packed: stages.packed ?? 0,
    shipped: stages.shipped ?? 0,
    warehouse:
      (stages.ready_for_warehouse ?? 0) + (stages.packed ?? 0),
    stageValues: perStageValueTotals(amt),
  };
}

export async function getUserStatsForToday(
  tenantId: string,
  userId: string,
): Promise<UserStats | null> {
  if (isDevMockDataEnabled()) return mockGetUserStatsForToday(tenantId, userId);
  const date = new Date().toISOString().slice(0, 10);
  const id = `${tenantId}_${userId}_${date}`;
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.userStats).doc(id).get();
  if (!snap.exists) {
    return {
      id,
      tenantId,
      userId,
      date,
      confirmed: 0,
      invoiced: 0,
      packed: 0,
      updatedAt: new Date().toISOString(),
    };
  }
  return snap.data() as UserStats;
}
