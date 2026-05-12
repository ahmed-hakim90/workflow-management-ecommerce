import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDevMockBackend } from "@/lib/dev/mock-backend";
import { getAnalyticsDailyDoc } from "@/lib/services/analytics-daily.service";
import { mockListActivities } from "@/lib/dev/mock-backend";
import {
  deleteOrder,
  upsertOrderFromWooCommerce,
} from "@/lib/services/orders.service";

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

describe("orders service", () => {
  it("removes deleted orders from daily analytics totals", async () => {
    const { order } = await upsertOrderFromWooCommerce({
      tenantId: "default",
      wooOrderId: "delete-analytics-1",
      customer: { name: "Deleted Customer" },
      payment: {
        payment_status: "paid",
        total_amount: 250,
        paid_amount: 250,
        remaining_amount: 0,
        cod_amount: 0,
      },
      actorUserId: "user-admin-1",
    });
    const date = order.createdAt.slice(0, 10);

    const beforeDelete = await getAnalyticsDailyDoc("default", date);
    expect(beforeDelete.orders_count).toBeGreaterThanOrEqual(1);
    expect(beforeDelete.orders_value).toBeGreaterThanOrEqual(250);

    await deleteOrder({
      tenantId: "default",
      orderId: order.id,
      actorUserId: "user-admin-1",
    });

    const afterDelete = await getAnalyticsDailyDoc("default", date);
    expect(afterDelete.orders_count).toBe(beforeDelete.orders_count - 1);
    expect(afterDelete.orders_value).toBe(beforeDelete.orders_value - 250);
  });

  it("skips redundant webhook activity when ingest fingerprint is unchanged", async () => {
    const base = {
      tenantId: "default",
      wooOrderId: "fp-dedup-woo-1",
      customer: { name: "Fingerprint User" },
      payment: {
        payment_status: "paid" as const,
        total_amount: 88,
        paid_amount: 88,
        remaining_amount: 0,
        cod_amount: 0,
      },
      actorUserId: "system:test",
      lineItems: [
        {
          name: "Item",
          quantity: 1,
          unit_price: 88,
          line_total: 88,
        },
      ],
    };
    const { order: created } = await upsertOrderFromWooCommerce(base);
    await upsertOrderFromWooCommerce(base);
    const upsertLogs = mockListActivities({
      tenantId: "default",
      entityType: "order",
      entityId: created.id,
      limit: 50,
    }).filter((a) => a.action === "order.upsert_webhook");
    expect(upsertLogs.length).toBe(0);
  });
});
