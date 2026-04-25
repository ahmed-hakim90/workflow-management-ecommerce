import type { Order, OrderStatus, TenantAutomationSettings } from "@/lib/types/models";

export function shouldAutoCreateShipment(
  prevStatus: OrderStatus,
  newStatus: OrderStatus,
  settings: TenantAutomationSettings,
): boolean {
  if (!settings.auto_create_shipment) return false;
  if (settings.create_shipment_stage === "confirmed") {
    return prevStatus !== "confirmed" && newStatus === "confirmed";
  }
  // "invoiced" in spec → after invoicing completes we land in ready_for_warehouse
  if (settings.create_shipment_stage === "invoiced") {
    return (
      prevStatus !== "ready_for_warehouse" && newStatus === "ready_for_warehouse"
    );
  }
  return false;
}

export function orderNeedsDeliveryShipment(order: Order): boolean {
  return !order.shipmentIds?.length;
}
