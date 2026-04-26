import { describe, expect, it } from "vitest";
import type { OrderStatus } from "../types/models";
import {
  mapOrderStatusToWooCommerce,
  type WooCommerceOrderStatus,
} from "./woocommerce-status-map";

describe("mapOrderStatusToWooCommerce", () => {
  const cases: [OrderStatus, WooCommerceOrderStatus][] = [
    ["pending_confirmation", "on-hold"],
    ["confirmed", "processing"],
    ["invoicing", "processing"],
    ["ready_for_warehouse", "processing"],
    ["packed", "processing"],
    ["shipped", "processing"],
    ["delivered", "completed"],
    ["cancelled", "cancelled"],
    ["follow_up", "on-hold"],
  ];

  it.each(cases)("maps %s → %s", (oms, woo) => {
    expect(mapOrderStatusToWooCommerce(oms)).toBe(woo);
  });
});
