import { describe, expect, it } from "vitest";
import { buildPayment } from "./payment";

describe("payment", () => {
  it("computes remaining and cod", () => {
    const p = buildPayment({
      payment_status: "partial",
      total_amount: 100,
      paid_amount: 40,
    });
    expect(p.remaining_amount).toBe(60);
    expect(p.cod_amount).toBe(60);
  });
});
