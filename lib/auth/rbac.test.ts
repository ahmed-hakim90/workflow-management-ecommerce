import { describe, expect, it } from "vitest";
import { assertCan, can } from "./rbac";

describe("rbac", () => {
  it("admin can all", () => {
    expect(can("admin", "order:cancel")).toBe(true);
  });

  it("warehouse cannot cancel", () => {
    expect(can("warehouse", "order:cancel")).toBe(false);
  });

  it("warehouse can revert order", () => {
    expect(can("warehouse", "order:revert")).toBe(true);
  });

  it("assertCan throws", () => {
    expect(() => assertCan("warehouse", "order:cancel")).toThrow("Forbidden");
  });
});
