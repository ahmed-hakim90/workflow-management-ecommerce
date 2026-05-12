import { describe, expect, it } from "vitest";
import {
  arrayNeedsMigration,
  LEGACY_STATUS_MAP,
  mapLegacyStatus,
  mapLegacyStatusArray,
} from "./migrate-order-statuses.mapping";

describe("legacy status mapping", () => {
  it("rewrites every documented legacy value", () => {
    expect(mapLegacyStatus("invoicing")).toBe("invoiced");
    expect(mapLegacyStatus("ready_for_warehouse")).toBe("ready_for_shipping");
    expect(mapLegacyStatus("packed")).toBe("warehouse_packed");
    expect(mapLegacyStatus("shipped")).toBe("out_for_shipping");
    expect(mapLegacyStatus("follow_up")).toBe("failed_delivery");
  });

  it("keeps unchanged statuses untouched", () => {
    expect(mapLegacyStatus("pending_confirmation")).toBe("pending_confirmation");
    expect(mapLegacyStatus("confirmed")).toBe("confirmed");
    expect(mapLegacyStatus("delivered")).toBe("delivered");
    expect(mapLegacyStatus("cancelled")).toBe("cancelled");
  });

  it("returns null on unknown / empty values", () => {
    expect(mapLegacyStatus("")).toBeNull();
    expect(mapLegacyStatus(undefined)).toBeNull();
    expect(mapLegacyStatus("not-a-real-status")).toBeNull();
  });

  it("maps + dedups arrays of mixed legacy + new values", () => {
    const out = mapLegacyStatusArray([
      "shipped",
      "out_for_shipping",
      "follow_up",
      "delivered",
      "garbage",
    ]);
    expect(out).toEqual(
      expect.arrayContaining([
        "out_for_shipping",
        "failed_delivery",
        "delivered",
      ]),
    );
    // dedup
    expect(new Set(out).size).toBe(out.length);
    // garbage filtered
    expect(out).not.toContain("garbage");
  });

  it("flags arrays needing migration only when legacy values are present", () => {
    expect(arrayNeedsMigration(["confirmed", "invoiced"])).toBe(false);
    expect(arrayNeedsMigration(["confirmed", "invoicing"])).toBe(true);
    expect(arrayNeedsMigration([])).toBe(false);
    expect(arrayNeedsMigration("not-an-array" as unknown)).toBe(false);
  });

  it("LEGACY_STATUS_MAP has the 5 expected migrations", () => {
    expect(Object.keys(LEGACY_STATUS_MAP).sort()).toEqual([
      "follow_up",
      "invoicing",
      "packed",
      "ready_for_warehouse",
      "shipped",
    ]);
  });
});
