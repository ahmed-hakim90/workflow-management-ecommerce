import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "./order-state-machine";

describe("order-state-machine", () => {
  it("allows happy path", () => {
    expect(canTransition("pending_confirmation", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "invoicing")).toBe(true);
    expect(canTransition("invoicing", "ready_for_warehouse")).toBe(true);
  });

  it("rejects illegal jumps", () => {
    expect(canTransition("pending_confirmation", "shipped")).toBe(false);
  });

  it("assertTransition throws", () => {
    expect(() => assertTransition("shipped", "confirmed")).toThrow();
  });
});
