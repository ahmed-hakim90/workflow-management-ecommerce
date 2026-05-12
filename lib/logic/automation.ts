import type { Order, OrderStatus, TenantAutomationSettings } from "@/lib/types/models";

/**
 * Decide whether the system should auto-create a delivery shipment as a side
 * effect of transitioning an order's status.
 *
 * Stages:
 *  - "confirmed"  → fires once, when the order first lands in `confirmed`.
 *    (Used by tenants that prepare AWBs immediately after confirmation.)
 *  - "invoiced"   → fires once, when the order first lands in `ready_for_shipping`.
 *    (Used by tenants that wait until the invoice has been issued.)
 *
 * NOTE: AWB creation requires an invoice for "invoiced" stage; the FSM gate in
 * `assertTransitionAllowed` enforces that on the actual `awb_created` transition.
 */
export function shouldAutoCreateShipment(
  prevStatus: OrderStatus,
  newStatus: OrderStatus,
  settings: TenantAutomationSettings,
): boolean {
  if (!settings.auto_create_shipment) return false;
  if (settings.create_shipment_stage === "confirmed") {
    return prevStatus !== "confirmed" && newStatus === "confirmed";
  }
  if (settings.create_shipment_stage === "invoiced") {
    return (
      prevStatus !== "ready_for_shipping" && newStatus === "ready_for_shipping"
    );
  }
  return false;
}

export function orderNeedsDeliveryShipment(order: Order): boolean {
  return !order.shipmentIds?.length;
}
