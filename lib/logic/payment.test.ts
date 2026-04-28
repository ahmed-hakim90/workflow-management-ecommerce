import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/types/models";
import { codAmountFromOrder } from "@/lib/integrations/bosta";
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

  it("uses the remaining amount as Bosta collection for partial orders", () => {
    const order = {
      id: "order-1",
      tenantId: "default",
      customer: { name: "Customer" },
      payment: buildPayment({
        payment_status: "partial",
        total_amount: 1000,
        paid_amount: 300,
      }),
      status: "confirmed",
      shipmentIds: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies Order;

    expect(codAmountFromOrder(order)).toBe(700);
  });
});
