import type { OrderStatus } from "@/lib/types/models";

/**
 * Legacy → new status migration map.
 *
 * Statuses that don't appear in this map (e.g. `pending_confirmation`,
 * `confirmed`, `delivered`, `cancelled`) are kept as-is.
 *
 * البيانات القديمة عندها 9 حالات؛ الـ 17 حالة الجديدة في `OrderStatus`.
 */
export const LEGACY_STATUS_MAP: Record<string, OrderStatus> = {
  invoicing: "invoiced",
  ready_for_warehouse: "ready_for_shipping",
  packed: "warehouse_packed",
  shipped: "out_for_shipping",
  follow_up: "failed_delivery",
};

const VALID_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "new",
  "pending_confirmation",
  "confirmed",
  "cancelled",
  "invoice_required",
  "invoiced",
  "ready_for_shipping",
  "awb_created",
  "warehouse_picking",
  "warehouse_packed",
  "out_for_shipping",
  "delivered",
  "failed_delivery",
  "returned",
  "exchange_requested",
  "replacement_created",
  "closed",
]);

/**
 * Map a (possibly legacy) stored status string to a current `OrderStatus`.
 * Returns `null` if the value is unknown — caller decides whether to skip
 * or surface a warning.
 */
export function mapLegacyStatus(value: string | undefined | null): OrderStatus | null {
  if (!value) return null;
  if (VALID_STATUSES.has(value as OrderStatus)) return value as OrderStatus;
  if (value in LEGACY_STATUS_MAP) return LEGACY_STATUS_MAP[value];
  return null;
}

/**
 * Map an array of legacy status values (used by Kanban + outbound webhook
 * configs). Drops unknown values and dedups.
 */
export function mapLegacyStatusArray(values: unknown): OrderStatus[] {
  if (!Array.isArray(values)) return [];
  const out = new Set<OrderStatus>();
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const next = mapLegacyStatus(raw);
    if (next) out.add(next);
  }
  return [...out];
}

/**
 * True if any value in the array represents a legacy status that needs to
 * be rewritten. Used to keep the migration idempotent: skip a doc when
 * everything is already on the new model.
 */
export function arrayNeedsMigration(values: unknown): boolean {
  if (!Array.isArray(values)) return false;
  return values.some(
    (v) =>
      typeof v === "string" &&
      !VALID_STATUSES.has(v as OrderStatus) &&
      v in LEGACY_STATUS_MAP,
  );
}
