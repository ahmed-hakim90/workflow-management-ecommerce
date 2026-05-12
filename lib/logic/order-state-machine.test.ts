import { describe, expect, it } from "vitest";
import {
  assertTransition,
  assertTransitionAllowed,
  canTransition,
  TransitionBlockedError,
  allowedNextStatuses,
} from "./order-state-machine";
import type { Order } from "../types/models";

describe("order-state-machine — raw FSM", () => {
  it("allows the canonical happy path through all 17 statuses", () => {
    expect(canTransition("new", "pending_confirmation")).toBe(true);
    expect(canTransition("pending_confirmation", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "invoice_required")).toBe(true);
    expect(canTransition("invoice_required", "invoiced")).toBe(true);
    expect(canTransition("invoiced", "ready_for_shipping")).toBe(true);
    expect(canTransition("ready_for_shipping", "awb_created")).toBe(true);
    expect(canTransition("awb_created", "warehouse_picking")).toBe(true);
    expect(canTransition("warehouse_picking", "warehouse_packed")).toBe(true);
    expect(canTransition("warehouse_packed", "out_for_shipping")).toBe(true);
    expect(canTransition("out_for_shipping", "delivered")).toBe(true);
    expect(canTransition("delivered", "closed")).toBe(true);
  });

  it("permits per_step warehouse skip (awb_created → warehouse_packed)", () => {
    expect(canTransition("awb_created", "warehouse_packed")).toBe(true);
  });

  it("permits returns / exchange branches", () => {
    expect(canTransition("delivered", "returned")).toBe(true);
    expect(canTransition("delivered", "exchange_requested")).toBe(true);
    expect(canTransition("returned", "replacement_created")).toBe(true);
    expect(canTransition("exchange_requested", "replacement_created")).toBe(true);
    expect(canTransition("replacement_created", "ready_for_shipping")).toBe(true);
  });

  it("permits failed_delivery branches", () => {
    expect(canTransition("out_for_shipping", "failed_delivery")).toBe(true);
    expect(canTransition("failed_delivery", "out_for_shipping")).toBe(true);
    expect(canTransition("failed_delivery", "returned")).toBe(true);
    expect(canTransition("failed_delivery", "exchange_requested")).toBe(true);
    expect(canTransition("failed_delivery", "closed")).toBe(true);
  });

  it("permits cancellation only before AWB", () => {
    expect(canTransition("new", "cancelled")).toBe(true);
    expect(canTransition("pending_confirmation", "cancelled")).toBe(true);
    expect(canTransition("confirmed", "cancelled")).toBe(true);
    expect(canTransition("invoice_required", "cancelled")).toBe(true);
    expect(canTransition("invoiced", "cancelled")).toBe(true);
    expect(canTransition("ready_for_shipping", "cancelled")).toBe(true);
    expect(canTransition("awb_created", "cancelled")).toBe(true);
    // After warehouse takes over, cancel is blocked.
    expect(canTransition("warehouse_picking", "cancelled")).toBe(false);
    expect(canTransition("warehouse_packed", "cancelled")).toBe(false);
    expect(canTransition("out_for_shipping", "cancelled")).toBe(false);
  });

  it("rejects illegal jumps", () => {
    expect(canTransition("pending_confirmation", "out_for_shipping")).toBe(false);
    expect(canTransition("confirmed", "delivered")).toBe(false);
    expect(canTransition("invoiced", "warehouse_packed")).toBe(false);
    expect(canTransition("ready_for_shipping", "out_for_shipping")).toBe(false);
  });

  it("closes are terminal", () => {
    expect(canTransition("closed", "delivered")).toBe(false);
    expect(allowedNextStatuses("closed")).toEqual([]);
  });

  it("assertTransition throws on illegal jump", () => {
    expect(() => assertTransition("out_for_shipping", "confirmed")).toThrow();
  });
});

const baseOrder = (
  overrides: Partial<Order> = {},
): Pick<Order, "status" | "invoice" | "shipmentIds" | "latestShipmentAwb"> => ({
  status: "confirmed",
  shipmentIds: [],
  ...overrides,
});

describe("order-state-machine — assertTransitionAllowed gates", () => {
  it("blocks invoice-gated transitions when invoice is missing", () => {
    expect(() =>
      assertTransitionAllowed(
        baseOrder({ status: "invoiced" }),
        "ready_for_shipping",
      ),
    ).toThrow(TransitionBlockedError);
  });

  it("permits invoice-gated transitions when invoice is set", () => {
    expect(() =>
      assertTransitionAllowed(
        baseOrder({
          status: "invoiced",
          invoice: { number: "INV-1", issuedAt: "2026-04-24T10:00:00Z" },
        }),
        "ready_for_shipping",
      ),
    ).not.toThrow();
  });

  it("blocks warehouse_packed when no AWB exists", () => {
    expect(() =>
      assertTransitionAllowed(
        baseOrder({
          status: "awb_created",
          invoice: { number: "INV-1", issuedAt: "2026-04-24T10:00:00Z" },
          shipmentIds: [],
        }),
        "warehouse_packed",
      ),
    ).toThrow(TransitionBlockedError);
  });

  it("permits warehouse_packed when AWB is set", () => {
    expect(() =>
      assertTransitionAllowed(
        baseOrder({
          status: "awb_created",
          invoice: { number: "INV-1", issuedAt: "2026-04-24T10:00:00Z" },
          shipmentIds: ["sh-1"],
          latestShipmentAwb: "AWB-123",
        }),
        "warehouse_packed",
      ),
    ).not.toThrow();
  });

  it("rejects invalid forward transitions with reason invalid_transition", () => {
    try {
      assertTransitionAllowed(
        baseOrder({ status: "pending_confirmation" }),
        "out_for_shipping",
      );
      expect.fail("expected TransitionBlockedError");
    } catch (err) {
      expect(err).toBeInstanceOf(TransitionBlockedError);
      expect((err as TransitionBlockedError).reason).toBe("invalid_transition");
    }
  });
});
