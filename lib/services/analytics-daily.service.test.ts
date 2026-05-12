import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDevMockBackend } from "@/lib/dev/mock-backend";
import {
  aggregateAnalyticsRange,
  aggregateCarrierFinancials,
  getAnalyticsDailyDoc,
  rebuildAnalyticsDay,
} from "@/lib/services/analytics-daily.service";
import { createShipmentForOrder } from "@/lib/services/shipments.service";
import { createTicket, resolveTicket } from "@/lib/services/tickets.service";
import { upsertOrderFromWooCommerce } from "@/lib/services/orders.service";

const originalDevMockData = process.env.DEV_MOCK_DATA;

beforeEach(() => {
  process.env.DEV_MOCK_DATA = "true";
  resetDevMockBackend();
});

afterAll(() => {
  if (originalDevMockData === undefined) {
    delete process.env.DEV_MOCK_DATA;
  } else {
    process.env.DEV_MOCK_DATA = originalDevMockData;
  }
});

describe("analytics daily accounting", () => {
  it("records COGS from line item costs and derives net profit", async () => {
    const { order } = await upsertOrderFromWooCommerce({
      tenantId: "default",
      wooOrderId: "analytics-cogs-1",
      customer: { name: "COGS Customer" },
      payment: {
        payment_status: "paid",
        total_amount: 500,
        paid_amount: 500,
        remaining_amount: 0,
        cod_amount: 0,
      },
      actorUserId: "system:test",
      lineItems: [
        {
          name: "Costed item",
          quantity: 2,
          unit_price: 250,
          line_total: 500,
          unit_cost: 120,
        },
      ],
    });

    const date = order.createdAt.slice(0, 10);
    const row = await getAnalyticsDailyDoc("default", date);
    expect(row.orders_value).toBeGreaterThanOrEqual(500);
    expect(row.cogs_value).toBeGreaterThanOrEqual(240);

    const { totals } = await aggregateAnalyticsRange({
      tenantId: "default",
      from: date,
      to: date,
    });
    expect(totals.cogs_value).toBe(row.cogs_value);
  });

  it("tracks carrier cost by delivery, return, and exchange shipments", async () => {
    const delivery = await createShipmentForOrder({
      tenantId: "default",
      orderId: "a2222222-2222-4222-8222-222222222202",
      actorUserId: "user-admin-1",
      provider: "bosta",
    });
    await createShipmentForOrder({
      tenantId: "default",
      orderId: "a2222222-2222-4222-8222-222222222202",
      actorUserId: "user-admin-1",
      provider: "bosta",
      type: "return",
    });
    await createShipmentForOrder({
      tenantId: "default",
      orderId: "a3333333-3333-4333-8333-333333333303",
      actorUserId: "user-admin-1",
      provider: "jnt_egypt",
      type: "exchange",
    });

    const date = delivery.createdAt.slice(0, 10);
    const row = await getAnalyticsDailyDoc("default", date);
    expect(row.delivery_shipments_count).toBeGreaterThanOrEqual(1);
    expect(row.return_shipments_count).toBeGreaterThanOrEqual(1);
    expect(row.exchange_shipments_count).toBeGreaterThanOrEqual(1);
    expect(row.shipping_cost).toBe(
      row.delivery_shipping_cost +
        row.return_shipping_cost +
        row.exchange_shipping_cost,
    );

    const carriers = await aggregateCarrierFinancials({
      tenantId: "default",
      from: date,
      to: date,
    });
    const bosta = carriers.find((row) => row.provider === "bosta");
    const jnt = carriers.find((row) => row.provider === "jnt_egypt");
    expect(bosta?.delivery_count).toBeGreaterThanOrEqual(1);
    expect(bosta?.return_count).toBeGreaterThanOrEqual(1);
    expect(bosta?.delivery_cost).toBeGreaterThanOrEqual(0);
    expect(bosta?.return_cost).toBeGreaterThanOrEqual(0);
    expect(bosta?.total_debit).toBe(
      (bosta?.delivery_cost ?? 0) +
        (bosta?.return_cost ?? 0) +
        (bosta?.exchange_cost ?? 0),
    );
    expect(bosta?.total_credit).toBe(bosta?.cod_delivered);
    expect(bosta?.net_balance).toBe(
      (bosta?.total_debit ?? 0) - (bosta?.total_credit ?? 0),
    );
    expect(jnt?.exchange_count).toBeGreaterThanOrEqual(1);
  });

  it("uses resolved refund amounts for return and exchange values", async () => {
    const returnTicket = await createTicket({
      tenantId: "default",
      order_id: "a2222222-2222-4222-8222-222222222202",
      type: "return",
      actorUserId: "user-admin-1",
    });
    const exchangeTicket = await createTicket({
      tenantId: "default",
      order_id: "a3333333-3333-4333-8333-333333333303",
      type: "exchange",
      actorUserId: "user-admin-1",
    });

    const resolvedReturn = await resolveTicket({
      tenantId: "default",
      ticketId: returnTicket.id,
      actorUserId: "user-admin-1",
      resolutionKind: "return",
      refundAmount: 75,
    });
    await resolveTicket({
      tenantId: "default",
      ticketId: exchangeTicket.id,
      actorUserId: "user-admin-1",
      resolutionKind: "exchange",
      refundAmount: 20,
    });

    const date = resolvedReturn.resolution?.resolvedAt.slice(0, 10) ?? "";
    const row = await rebuildAnalyticsDay("default", date);
    expect(row.returns_count).toBeGreaterThanOrEqual(1);
    expect(row.returns_value).toBe(75);
    expect(row.refunds_value).toBe(75);
    expect(row.exchanges_count).toBeGreaterThanOrEqual(1);
    expect(row.exchanges_value).toBe(20);
  });
});
