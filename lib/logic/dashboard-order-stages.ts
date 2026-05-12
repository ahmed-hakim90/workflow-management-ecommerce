import type { OrderStatus } from "@/lib/types/models";

/**
 * Pipeline statuses tracked by the dashboard rollup + Kanban stage metrics.
 * Terminal/cancellation/return statuses are NOT counted here — they appear
 * elsewhere (analytics_daily) so the running pipeline view stays clean.
 */
export const DASHBOARD_ORDER_STAGE_KEYS = [
  "new",
  "pending_confirmation",
  "confirmed",
  "invoice_required",
  "invoiced",
  "ready_for_shipping",
  "awb_created",
  "warehouse_picking",
  "warehouse_packed",
  "out_for_shipping",
] as const;

export type DashboardOrderStageKey = (typeof DASHBOARD_ORDER_STAGE_KEYS)[number];

export function isDashboardOrderStage(
  s: OrderStatus,
): s is DashboardOrderStageKey {
  return (DASHBOARD_ORDER_STAGE_KEYS as readonly string[]).includes(s);
}

export function emptyDashboardStages(): Record<DashboardOrderStageKey, number> {
  return Object.fromEntries(
    DASHBOARD_ORDER_STAGE_KEYS.map((k) => [k, 0]),
  ) as Record<DashboardOrderStageKey, number>;
}

/** Same shape as `emptyDashboardStages` for monetary pipeline totals. */
export function emptyDashboardStageValues(): Record<DashboardOrderStageKey, number> {
  return Object.fromEntries(
    DASHBOARD_ORDER_STAGE_KEYS.map((k) => [k, 0]),
  ) as Record<DashboardOrderStageKey, number>;
}
