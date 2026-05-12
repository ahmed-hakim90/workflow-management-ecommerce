import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import type { UserStats } from "@/lib/types/models";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import { mockGetUserStatsForToday } from "@/lib/dev/mock-backend";
import { listOrders } from "@/lib/services/orders.service";
import {
  getTenantOrderStageRollup,
  orderValueForStageRollup,
} from "@/lib/services/order-stage-rollup.service";
import {
  DASHBOARD_ORDER_STAGE_KEYS,
  emptyDashboardStages,
  emptyDashboardStageValues,
  isDashboardOrderStage,
  type DashboardOrderStageKey,
} from "@/lib/logic/dashboard-order-stages";

type KanbanStageKey = DashboardOrderStageKey;

const KANBAN_STATUS_SET = new Set<string>(DASHBOARD_ORDER_STAGE_KEYS);

/**
 * Pipeline counts plus a virtual `warehouse` rollup
 * (warehouse_picking + warehouse_packed) and matching `stageValues`.
 */
export type OrdersPerStageResult = {
  [K in KanbanStageKey | "warehouse"]: number;
} & {
  stageValues: { [K in KanbanStageKey | "warehouse"]: number };
};

function withWarehouseRollup<T extends Record<KanbanStageKey, number>>(
  v: T,
): T & { warehouse: number } {
  return {
    ...v,
    warehouse: (v.warehouse_picking ?? 0) + (v.warehouse_packed ?? 0),
  };
}

const ZERO_STAGE: OrdersPerStageResult = (() => {
  const counts = emptyDashboardStages();
  const values = emptyDashboardStageValues();
  return {
    ...withWarehouseRollup(counts),
    stageValues: withWarehouseRollup(values),
  };
})();

export async function getOrdersPerStage(
  tenantId: string,
): Promise<OrdersPerStageResult> {
  if (isDevMockDataEnabled()) {
    const orders = await listOrders(tenantId);
    const counts = emptyDashboardStages();
    const amounts = emptyDashboardStageValues();
    for (const o of orders) {
      if (KANBAN_STATUS_SET.has(o.status)) {
        const b = o.status as KanbanStageKey;
        counts[b] += 1;
        amounts[b] += orderValueForStageRollup(o);
      }
    }
    return {
      ...withWarehouseRollup(counts),
      stageValues: withWarehouseRollup(amounts),
    };
  }

  const rollup = await getTenantOrderStageRollup(tenantId);

  if (!rollup?.stages) {
    return ZERO_STAGE;
  }

  const { stages, stageValues: sv0 } = rollup;
  const counts = emptyDashboardStages();
  const amounts = emptyDashboardStageValues();
  for (const k of DASHBOARD_ORDER_STAGE_KEYS) {
    counts[k] = stages[k] ?? 0;
    amounts[k] = sv0[k] ?? 0;
  }
  return {
    ...withWarehouseRollup(counts),
    stageValues: withWarehouseRollup(amounts),
  };
}

export async function getUserStatsForToday(
  tenantId: string,
  userId: string,
): Promise<UserStats | null> {
  if (isDevMockDataEnabled()) return mockGetUserStatsForToday(tenantId, userId);
  const date = new Date().toISOString().slice(0, 10);
  const id = `${tenantId}_${userId}_${date}`;
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("user_stats")
    .select("metrics, updated_at")
    .eq("tenant_id", tenantId)
    .eq("profile_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
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
  const metrics = (data.metrics ?? {}) as Partial<UserStats>;
  return {
    id,
    tenantId,
    userId,
    date,
    confirmed: metrics.confirmed ?? 0,
    invoiced: metrics.invoiced ?? 0,
    packed: metrics.packed ?? 0,
    updatedAt: data.updated_at ?? new Date().toISOString(),
  };
}

export { isDashboardOrderStage };
