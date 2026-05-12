import type { OrderStatus } from "@/lib/types/models";

/** WooCommerce core order statuses (REST `status` field). */
export type WooCommerceOrderStatus =
  | "pending"
  | "processing"
  | "on-hold"
  | "completed"
  | "cancelled"
  | "refunded"
  | "failed";

/**
 * Default mapping from Store OMS lifecycle to WooCommerce order status.
 *
 * - All "in-flight" statuses between confirmed and out_for_shipping map to
 *   `processing` so the storefront sees a single coherent "we're working on it".
 * - Refund/return-related statuses map to `refunded` only when terminal — the
 *   intermediate `returned` / `exchange_requested` map to `on-hold` so the
 *   refund decision happens explicitly later.
 */
export function mapOrderStatusToWooCommerce(
  status: OrderStatus,
): WooCommerceOrderStatus {
  switch (status) {
    case "new":
    case "pending_confirmation":
      return "on-hold";
    case "confirmed":
    case "invoice_required":
    case "invoiced":
    case "ready_for_shipping":
    case "awb_created":
    case "warehouse_picking":
    case "warehouse_packed":
    case "out_for_shipping":
    case "replacement_created":
      return "processing";
    case "delivered":
      return "completed";
    case "failed_delivery":
      return "failed";
    case "returned":
    case "exchange_requested":
      return "on-hold";
    case "cancelled":
      return "cancelled";
    case "closed":
      return "completed";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
