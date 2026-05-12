import { describe, expect, it } from "vitest";
import {
  ORDER_ACTIONS,
  availableActions,
  assertActionAllowed,
} from "./order-actions";
import type { Order } from "../types/models";

const baseOrder = (
  overrides: Partial<Order> = {},
): Pick<Order, "status" | "invoice" | "shipmentIds" | "latestShipmentAwb"> => ({
  status: "new",
  shipmentIds: [],
  ...overrides,
});

describe("availableActions — RBAC + FSM gates", () => {
  it("confirmation role on a new order can confirm or cancel", () => {
    const ids = availableActions(
      baseOrder({ status: "pending_confirmation" }),
      { role: "confirmation" },
    ).map((a) => a.id);
    expect(ids).toContain("confirm");
    expect(ids).toContain("cancel");
  });

  it("confirmation role cannot issue an invoice", () => {
    const ids = availableActions(
      baseOrder({ status: "invoice_required" }),
      { role: "confirmation" },
    ).map((a) => a.id);
    expect(ids).not.toContain("issue_invoice");
  });

  it("invoicing role can issue an invoice from invoice_required", () => {
    const ids = availableActions(
      baseOrder({ status: "invoice_required" }),
      { role: "invoicing" },
    ).map((a) => a.id);
    expect(ids).toContain("issue_invoice");
  });

  it("hides shipping-prep actions when invoice is missing", () => {
    const ids = availableActions(
      baseOrder({ status: "invoiced" }),
      { role: "warehouse" },
    ).map((a) => a.id);
    expect(ids).not.toContain("mark_ready_for_shipping");
  });

  it("shows ready-for-shipping when invoice is set", () => {
    const ids = availableActions(
      baseOrder({
        status: "invoiced",
        invoice: { number: "INV-1", issuedAt: "2026-01-01T00:00:00Z" },
      }),
      { role: "invoicing" },
    ).map((a) => a.id);
    expect(ids).toContain("mark_ready_for_shipping");
  });

  it("blocks warehouse_packed when AWB missing, allows when present", () => {
    const sansAwb = availableActions(
      baseOrder({
        status: "awb_created",
        invoice: { number: "INV-1", issuedAt: "2026-01-01T00:00:00Z" },
        shipmentIds: [],
      }),
      { role: "warehouse" },
    ).map((a) => a.id);
    expect(sansAwb).not.toContain("mark_packed");

    const withAwb = availableActions(
      baseOrder({
        status: "awb_created",
        invoice: { number: "INV-1", issuedAt: "2026-01-01T00:00:00Z" },
        shipmentIds: ["sh-1"],
        latestShipmentAwb: "AWB-001",
      }),
      { role: "warehouse" },
    ).map((a) => a.id);
    expect(withAwb).toContain("mark_packed");
  });

  it("admin sees everything reachable from current status", () => {
    const ids = availableActions(
      baseOrder({
        status: "delivered",
        invoice: { number: "INV-1", issuedAt: "2026-01-01T00:00:00Z" },
        shipmentIds: ["sh-1"],
        latestShipmentAwb: "AWB-1",
      }),
      { role: "admin" },
    ).map((a) => a.id);
    // From delivered we can return, exchange, or close.
    expect(ids).toEqual(
      expect.arrayContaining(["open_return", "open_exchange", "close"]),
    );
  });

  it("returns no actions on a closed order", () => {
    expect(
      availableActions(baseOrder({ status: "closed" }), { role: "admin" }),
    ).toEqual([]);
  });
});

describe("assertActionAllowed", () => {
  it("throws 403 when role lacks the action permission", () => {
    expect(() =>
      assertActionAllowed(
        baseOrder({ status: "pending_confirmation" }),
        "confirm",
        { role: "warehouse" },
      ),
    ).toThrow();
  });

  it("passes when action is reachable + role has permission", () => {
    expect(() =>
      assertActionAllowed(
        baseOrder({ status: "pending_confirmation" }),
        "confirm",
        { role: "confirmation" },
      ),
    ).not.toThrow();
  });
});

describe("ORDER_ACTIONS catalogue sanity", () => {
  it("has unique action ids", () => {
    const ids = ORDER_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("references valid permissions", () => {
    for (const action of ORDER_ACTIONS) {
      expect(action.permission).toMatch(/^[a-z]+:[a-z_]+$/);
    }
  });
});
