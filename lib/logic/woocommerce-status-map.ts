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
 * Default mapping from Hakimo OMS lifecycle to WooCommerce order status.
 * Shipped stays `processing` until `delivered` → `completed` (typical fulfillment flow).
 */
export function mapOrderStatusToWooCommerce(
  status: OrderStatus,
): WooCommerceOrderStatus {
  switch (status) {
    case "pending_confirmation":
      return "on-hold";
    case "confirmed":
    case "invoicing":
    case "ready_for_warehouse":
    case "packed":
    case "shipped":
      return "processing";
    case "delivered":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "follow_up":
      return "on-hold";
  }
}
