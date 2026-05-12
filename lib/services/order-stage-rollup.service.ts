import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
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
 * Merges legacy rollup rows that only have `stages` (no `stageValues` yet).
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

  const now = new Date().toISOString();
  const existing = await getTenantOrderStageRollup(tenantId);
  const stages = { ...(existing?.stages ?? emptyDashboardStages()) };
  const stageValues = { ...(existing?.stageValues ?? emptyDashboardStageValues()) };

  if (from && isDashboardOrderStage(from)) {
    stages[from] = Math.max(0, (stages[from] ?? 0) - 1);
    stageValues[from] = Math.max(0, (stageValues[from] ?? 0) - orderValue);
  }
  if (to && isDashboardOrderStage(to)) {
    stages[to] = (stages[to] ?? 0) + 1;
    stageValues[to] = (stageValues[to] ?? 0) + orderValue;
  }

  const { error } = await getSupabaseServiceRoleClient()
    .from("tenant_order_stage_stats")
    .upsert({
      tenant_id: tenantId,
      stages,
      totals: { stageValues },
      updated_at: now,
    });
  if (error) throw error;
}

/** Full recompute when rollup doc is missing (e.g. first deploy). */
export async function rebuildTenantOrderStageRollup(tenantId: string) {
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("orders")
    .select("status, payment")
    .eq("tenant_id", tenantId)
    .limit(5000);
  if (error) throw error;

  const stages = emptyDashboardStages();
  const stageValues = emptyDashboardStageValues();
  for (const row of data ?? []) {
    const o = row as Pick<Order, "status" | "payment">;
    if (isDashboardOrderStage(o.status)) {
      stages[o.status] += 1;
      const total = o.payment?.total_amount;
      const v = typeof total === "number" && !Number.isNaN(total) ? total : 0;
      stageValues[o.status] += v;
    }
  }

  const now = new Date().toISOString();
  const { error: upsertError } = await getSupabaseServiceRoleClient()
    .from("tenant_order_stage_stats")
    .upsert({
      tenant_id: tenantId,
      stages,
      totals: { stageValues },
      rebuilt_at: now,
      updated_at: now,
    });
  if (upsertError) throw upsertError;
}

export async function getTenantOrderStageRollup(
  tenantId: string,
): Promise<TenantOrderStageRollup | null> {
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("tenant_order_stage_stats")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { stages, stageValues } = normalizeRollupData({
    stages: data.stages,
    stageValues: data.totals?.stageValues,
  });
  return {
    tenantId,
    stages,
    stageValues,
    updatedAt: data.updated_at ?? new Date().toISOString(),
  };
}
