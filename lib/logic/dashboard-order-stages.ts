import type { OrderStatus } from "@/lib/types/models";

/** Pipeline statuses shown on dashboard / Kanban stage metrics. */
export const DASHBOARD_ORDER_STAGE_KEYS = [
  "pending_confirmation",
  "confirmed",
  "invoicing",
  "ready_for_warehouse",
  "packed",
  "shipped",
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
