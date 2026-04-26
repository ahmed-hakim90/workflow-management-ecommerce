import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDevMockBackend } from "../dev/mock-backend";
import { confirmOrder, upsertOrderFromWooCommerce } from "../services/orders.service";
import { claimIntegrationEvent } from "../services/integration-events.service";
import { omitUndefinedForFirestore } from "../util/json-snapshot";
import { mapWooCommerceOrder } from "./woocommerce-map";
import { resolveWooCommerceDeliveryId } from "./woocommerce-webhook";

const originalDevMockData = process.env.DEV_MOCK_DATA;

function wooPayload(id: string, total = "120.00") {
  return {
    id,
    billing: {
      first_name: "Sara",
      last_name: "Ali",
      email: "sara@example.com",
      phone: "01000000000",
      address_1: "12 Nile St",
      city: "Cairo",
      country: "EG",
    },
    total,
    payment_method: "cod",
    customer_note: "Leave at reception",
    line_items: [
      {
        id: 10,
        name: "T-Shirt",
        sku: "TS-1",
        quantity: 2,
        price: "50.00",
        total: "100.00",
      },
    ],
    shipping_lines: [{ method_title: "Flat rate", total: "20.00" }],
  };
}

function deliveryIdFor(rawBody: string): string {
  return resolveWooCommerceDeliveryId(
    new Request("https://example.test/api/webhooks/woocommerce", {
      method: "POST",
      body: rawBody,
    }),
    rawBody,
  );
}

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

describe("WooCommerce webhook order flow", () => {
  it("uses the provider delivery header when WooCommerce sends one", () => {
    const rawBody = JSON.stringify(wooPayload("woo-1"));
    const req = new Request("https://example.test/api/webhooks/woocommerce", {
      method: "POST",
      body: rawBody,
      headers: { "x-wc-webhook-delivery-id": "delivery-123" },
    });

    expect(resolveWooCommerceDeliveryId(req, rawBody)).toBe("delivery-123");
  });

  it("falls back to a stable body hash instead of sharing an unknown delivery id", () => {
    const firstBody = JSON.stringify(wooPayload("woo-2"));
    const secondBody = JSON.stringify(wooPayload("woo-3"));

    const firstDeliveryId = deliveryIdFor(firstBody);
    const firstRetryDeliveryId = deliveryIdFor(firstBody);
    const secondDeliveryId = deliveryIdFor(secondBody);

    expect(firstDeliveryId).toMatch(/^body-sha256-[a-f0-9]{32}$/);
    expect(firstDeliveryId).not.toBe("unknown");
    expect(firstRetryDeliveryId).toBe(firstDeliveryId);
    expect(secondDeliveryId).not.toBe(firstDeliveryId);
  });

  it("keeps idempotency per webhook payload when WooCommerce omits the delivery header", async () => {
    const firstDeliveryId = deliveryIdFor(JSON.stringify(wooPayload("woo-4")));
    const secondDeliveryId = deliveryIdFor(JSON.stringify(wooPayload("woo-5")));

    await expect(
      claimIntegrationEvent({
        tenantId: "default",
        source: "woocommerce",
        deliveryId: firstDeliveryId,
      }),
    ).resolves.toBe("new");
    await expect(
      claimIntegrationEvent({
        tenantId: "default",
        source: "woocommerce",
        deliveryId: firstDeliveryId,
      }),
    ).resolves.toBe("duplicate");
    await expect(
      claimIntegrationEvent({
        tenantId: "default",
        source: "woocommerce",
        deliveryId: secondDeliveryId,
      }),
    ).resolves.toBe("new");
  });

  it("creates a WooCommerce order in pending confirmation with no shipment side effect", async () => {
    const payload = wooPayload("woo-6");
    const mapped = mapWooCommerceOrder(payload);

    const order = await upsertOrderFromWooCommerce({
      tenantId: "default",
      wooOrderId: mapped.wooOrderId,
      customer: mapped.customer,
      payment: mapped.payment,
      actorUserId: "system:woocommerce",
      lineItems: mapped.lineItems,
      shipping: mapped.shipping,
      notes: mapped.notes,
      woocommerceOrderSnapshot: payload,
    });

    expect(order.wooCommerceOrderId).toBe("woo-6");
    expect(order.status).toBe("pending_confirmation");
    expect(order.shipmentIds).toEqual([]);
    expect(order.customer.name).toBe("Sara Ali");
  });

  it("drops undefined optional fields before writing Firestore documents", () => {
    const clean = omitUndefinedForFirestore({
      id: "order-1",
      notes: undefined,
      customer: {
        name: "Sara",
        email: undefined,
      },
    });

    expect(clean).toEqual({
      id: "order-1",
      customer: {
        name: "Sara",
      },
    });
  });

  it("updates the same WooCommerce order without moving an internal status backward", async () => {
    const payload = wooPayload("woo-7", "120.00");
    const mapped = mapWooCommerceOrder(payload);
    const created = await upsertOrderFromWooCommerce({
      tenantId: "default",
      wooOrderId: mapped.wooOrderId,
      customer: mapped.customer,
      payment: mapped.payment,
      actorUserId: "system:woocommerce",
      lineItems: mapped.lineItems,
      shipping: mapped.shipping,
      notes: mapped.notes,
      woocommerceOrderSnapshot: payload,
    });

    const confirmed = await confirmOrder({
      tenantId: "default",
      orderId: created.id,
      actorUserId: "user-1",
    });
    expect(confirmed.status).toBe("confirmed");

    const changedPayload = {
      ...wooPayload("woo-7", "999.00"),
      billing: { ...payload.billing, first_name: "Mona" },
    };
    const changedMapped = mapWooCommerceOrder(changedPayload);
    const updated = await upsertOrderFromWooCommerce({
      tenantId: "default",
      wooOrderId: changedMapped.wooOrderId,
      customer: changedMapped.customer,
      payment: changedMapped.payment,
      actorUserId: "system:woocommerce",
      lineItems: changedMapped.lineItems,
      shipping: changedMapped.shipping,
      notes: changedMapped.notes,
      woocommerceOrderSnapshot: changedPayload,
    });

    expect(updated.id).toBe(created.id);
    expect(updated.status).toBe("confirmed");
    expect(updated.payment.total_amount).toBe(created.payment.total_amount);
    expect(updated.customer.name).toBe("Mona Ali");
  });
});
