import { describe, expect, it } from "vitest";
import {
  assertCan,
  can,
  canAccessPage,
  effectivePermissions,
} from "./rbac";

describe("rbac", () => {
  it("admin can all", () => {
    expect(can("admin", "order:cancel")).toBe(true);
    expect(can("admin", "order:delete")).toBe(true);
    expect(can("admin", "ticket:delete")).toBe(true);
  });

  it("warehouse cannot cancel", () => {
    expect(can("warehouse", "order:cancel")).toBe(false);
  });

  it("moderator cannot delete orders", () => {
    expect(can("moderator", "order:delete")).toBe(false);
    expect(can("moderator", "ticket:delete")).toBe(false);
  });

  it("warehouse can revert order", () => {
    expect(can("warehouse", "order:revert")).toBe(true);
  });

  it("assertCan throws", () => {
    expect(() => assertCan("warehouse", "order:cancel")).toThrow("Forbidden");
  });

  it("custom permissions can add permissions outside the role defaults", () => {
    expect(
      can({ role: "support", permissions: ["page:admin"] }, "page:admin"),
    ).toBe(true);
  });

  it("custom permissions can remove role defaults", () => {
    expect(
      can({ role: "admin", permissions: ["-page:analytics"] }, "page:analytics"),
    ).toBe(false);
  });

  it("finance is hidden by default, even for admin", () => {
    expect(can("admin", "finance:view")).toBe(false);
    expect(can({ role: "admin", permissions: ["finance:view"] }, "finance:view")).toBe(true);
  });

  it("checks page permissions through canAccessPage", () => {
    expect(canAccessPage("warehouse", "page:warehouse")).toBe(true);
    expect(canAccessPage("warehouse", "page:users")).toBe(false);
  });

  it("effective permissions applies positive and negative overrides", () => {
    const perms = effectivePermissions({
      role: "support",
      permissions: ["page:users", "-ticket:assign"],
    });
    expect(perms).toContain("page:users");
    expect(perms).not.toContain("ticket:assign");
  });
});
