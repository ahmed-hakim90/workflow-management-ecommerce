import { describe, expect, it } from "vitest";
import { orderIngestFingerprint } from "@/lib/logic/order-ingest-fingerprint";
import { buildPayment } from "@/lib/logic/payment";

describe("orderIngestFingerprint", () => {
  it("matches for identical normalized payloads", () => {
    const a = orderIngestFingerprint({
      customer: { name: "  Ali  ", phone: "0100" },
      payment: buildPayment({
        payment_status: "cod",
        total_amount: 100,
        paid_amount: 0,
      }),
      lineItems: [{ name: "X", quantity: 1, unit_price: 100, line_total: 100 }],
      notes: " hi ",
    });
    const b = orderIngestFingerprint({
      customer: { name: "Ali", phone: "0100" },
      payment: buildPayment({
        payment_status: "cod",
        total_amount: 100,
        paid_amount: 0,
      }),
      lineItems: [{ name: "X", quantity: 1, unit_price: 100, line_total: 100 }],
      notes: "hi",
    });
    expect(a).toBe(b);
  });

  it("differs when totals change", () => {
    const a = orderIngestFingerprint({
      customer: { name: "A" },
      payment: buildPayment({
        payment_status: "paid",
        total_amount: 50,
        paid_amount: 50,
      }),
    });
    const b = orderIngestFingerprint({
      customer: { name: "A" },
      payment: buildPayment({
        payment_status: "paid",
        total_amount: 51,
        paid_amount: 51,
      }),
    });
    expect(a).not.toBe(b);
  });
});
