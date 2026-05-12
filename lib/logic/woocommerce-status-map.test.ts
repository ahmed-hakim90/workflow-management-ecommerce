import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, type OrderStatus } from "../types/models";
import {
  mapOrderStatusToWooCommerce,
  type WooCommerceOrderStatus,
} from "./woocommerce-status-map";

describe("mapOrderStatusToWooCommerce", () => {
  const cases: [OrderStatus, WooCommerceOrderStatus][] = [
    ["new", "on-hold"],
    ["pending_confirmation", "on-hold"],
    ["confirmed", "processing"],
    ["invoice_required", "processing"],
    ["invoiced", "processing"],
    ["ready_for_shipping", "processing"],
    ["awb_created", "processing"],
    ["warehouse_picking", "processing"],
    ["warehouse_packed", "processing"],
    ["out_for_shipping", "processing"],
    ["delivered", "completed"],
    ["failed_delivery", "failed"],
    ["returned", "on-hold"],
    ["exchange_requested", "on-hold"],
    ["replacement_created", "processing"],
    ["cancelled", "cancelled"],
    ["closed", "completed"],
  ];

  it.each(cases)("maps %s → %s", (oms, woo) => {
    expect(mapOrderStatusToWooCommerce(oms)).toBe(woo);
  });

  it("covers every OrderStatus in the union", () => {
    for (const status of ORDER_STATUSES) {
      expect(() => mapOrderStatusToWooCommerce(status)).not.toThrow();
    }
  });
});
