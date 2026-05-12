import { describe, expect, it } from "vitest";
import { shouldAutoCreateShipment } from "./automation";

describe("automation", () => {
  it("confirmed stage triggers on confirmed", () => {
    expect(
      shouldAutoCreateShipment(
        "pending_confirmation",
        "confirmed",
        { auto_create_shipment: true, create_shipment_stage: "confirmed" },
      ),
    ).toBe(true);
  });

  it("invoiced stage triggers on ready_for_shipping", () => {
    expect(
      shouldAutoCreateShipment(
        "invoiced",
        "ready_for_shipping",
        { auto_create_shipment: true, create_shipment_stage: "invoiced" },
      ),
    ).toBe(true);
  });

  it("does not trigger when auto-create is disabled", () => {
    expect(
      shouldAutoCreateShipment(
        "invoiced",
        "ready_for_shipping",
        { auto_create_shipment: false, create_shipment_stage: "invoiced" },
      ),
    ).toBe(false);
  });
});
