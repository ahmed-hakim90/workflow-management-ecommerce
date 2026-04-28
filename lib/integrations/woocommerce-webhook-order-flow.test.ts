import { createHmac } from "crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDevMockBackend } from "../dev/mock-backend";
import { confirmOrder, upsertOrderFromWooCommerce } from "../services/orders.service";
import { claimIntegrationEvent } from "../services/integration-events.service";
import {
  createTenantRecord,
  resolveTenantByIdOrSlug,
} from "../services/tenants.service";
import {
  setTenantStorefrontOrderFields,
  setTenantWooCommerceRestFields,
  setTenantWooCommerceWebhookSecret,
} from "../services/tenant-settings.service";
import { listRecentWebhookIngestLogs } from "../services/webhook-ingest-logs.service";
import { omitUndefinedForFirestore } from "../util/json-snapshot";
import { mapWooCommerceOrder } from "./woocommerce-map";
import { resolveWooCommerceDeliveryId } from "./woocommerce-webhook";
import { POST as postWooCommerceWebhook } from "../../app/api/webhooks/woocommerce/route";
import { POST as postStorefrontOrderWebhook } from "../../app/api/webhooks/storefront-orders/route";
import { GET as getIntegrationsSettings } from "../../app/api/settings/integrations/route";
import { POST as syncWooCommerceWebhooks } from "../../app/api/settings/woocommerce/webhooks/sync/route";
import { POST as testWooCommerceWebhook } from "../../app/api/settings/woocommerce/webhooks/test/route";

const originalDevMockData = process.env.DEV_MOCK_DATA;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

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

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(() => {
  if (originalDevMockData === undefined) {
    delete process.env.DEV_MOCK_DATA;
  } else {
    process.env.DEV_MOCK_DATA = originalDevMockData;
  }
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});

describe("WooCommerce webhook order flow", () => {
  it("creates unique tenant slugs from company names", async () => {
    const tenant = await createTenantRecord("Acme Store");

    expect(tenant.slug).toBe("acme-store");
    await expect(createTenantRecord("  acme   store  ")).rejects.toMatchObject({
      status: 409,
    });
  });

  it("resolves tenants by either id or slug", async () => {
    const tenant = await createTenantRecord("Slug Lookup Co");

    await expect(resolveTenantByIdOrSlug(tenant.id)).resolves.toMatchObject({
      id: tenant.id,
    });
    await expect(resolveTenantByIdOrSlug("slug-lookup-co")).resolves.toMatchObject({
      id: tenant.id,
    });
  });

  it("shows the WooCommerce webhook URL with the tenant slug", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://oms.example.test";
    const tenant = await createTenantRecord("Webhook URL Co");

    const res = await getIntegrationsSettings(
      new Request("https://oms.example.test/api/settings/integrations", {
        headers: {
          authorization: `Bearer ${tenant.staffApiKey}`,
          "x-tenant-id": tenant.id,
          "x-user-id": "admin-1",
          "x-user-role": "admin",
        },
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.woocommerceWebhookUrl).toBe(
      "https://oms.example.test/api/webhooks/woocommerce?tenant=webhook-url-co",
    );
  });

  it("accepts WooCommerce webhooks addressed by tenant slug", async () => {
    const tenant = await createTenantRecord("Woo Slug Co");
    await setTenantWooCommerceWebhookSecret(tenant.id, "woo-secret");
    const rawBody = JSON.stringify(wooPayload("woo-slug-1"));
    const signature = createHmac("sha256", "woo-secret")
      .update(rawBody)
      .digest("base64");

    const res = await postWooCommerceWebhook(
      new Request(
        "https://oms.example.test/api/webhooks/woocommerce?tenant=woo-slug-co",
        {
          method: "POST",
          body: rawBody,
          headers: {
            "x-wc-webhook-signature": signature,
            "x-wc-webhook-delivery-id": "delivery-slug-1",
          },
        },
      ),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.orderId).toEqual(expect.any(String));
  });

  it("accepts forwarded storefront orders addressed by tenant slug", async () => {
    const tenant = await createTenantRecord("Forwarded Orders Co");
    await setTenantStorefrontOrderFields(tenant.id, {
      webhookSecret: "forward-secret",
      secretHeaderName: "x-api-secret",
    });
    const rawBody = JSON.stringify({
      event: "order.created",
      source: "sokany-store",
      order: wooPayload("forwarded-1"),
    });

    const res = await postStorefrontOrderWebhook(
      new Request(
        "https://oms.example.test/api/webhooks/storefront-orders?tenant=forwarded-orders-co",
        {
          method: "POST",
          body: rawBody,
          headers: {
            "x-api-secret": "forward-secret",
            "x-order-forwarding-delivery-id": "forwarded-delivery-1",
          },
        },
      ),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.orderId).toEqual(expect.any(String));
  });

  it("rejects forwarded storefront orders with the wrong secret", async () => {
    const tenant = await createTenantRecord("Forwarded Secret Co");
    await setTenantStorefrontOrderFields(tenant.id, {
      webhookSecret: "forward-secret",
      secretHeaderName: "x-api-secret",
    });
    const rawBody = JSON.stringify({
      event: "order.created",
      source: "sokany-store",
      order: wooPayload("forwarded-401"),
    });

    const res = await postStorefrontOrderWebhook(
      new Request(
        "https://oms.example.test/api/webhooks/storefront-orders?tenant=forwarded-secret-co",
        {
          method: "POST",
          body: rawBody,
          headers: {
            "x-api-secret": "wrong-secret",
            "x-order-forwarding-delivery-id": "forwarded-delivery-401",
          },
        },
      ),
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Invalid storefront order secret");
  });

  it("keeps accepting WooCommerce webhooks addressed by tenant id", async () => {
    const tenant = await createTenantRecord("Woo Id Co");
    await setTenantWooCommerceWebhookSecret(tenant.id, "woo-secret");
    const rawBody = JSON.stringify(wooPayload("woo-id-1"));
    const signature = createHmac("sha256", "woo-secret")
      .update(rawBody)
      .digest("base64");

    const res = await postWooCommerceWebhook(
      new Request(
        `https://oms.example.test/api/webhooks/woocommerce?tenant=${tenant.id}`,
        {
          method: "POST",
          body: rawBody,
          headers: {
            "x-wc-webhook-signature": signature,
            "x-wc-webhook-delivery-id": "delivery-id-1",
          },
        },
      ),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.orderId).toEqual(expect.any(String));
  });

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

  it("runs a signed diagnostic webhook without saving an order", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://oms.example.test";
    const tenant = await createTenantRecord("Diagnostic Woo Co");
    await setTenantWooCommerceWebhookSecret(tenant.id, "woo-secret");

    const res = await testWooCommerceWebhook(
      new Request("https://oms.example.test/api/settings/woocommerce/webhooks/test", {
        method: "POST",
        headers: {
          authorization: `Bearer ${tenant.staffApiKey}`,
          "x-tenant-id": tenant.id,
          "x-user-id": "admin-1",
          "x-user-role": "admin",
        },
      }),
    );
    const json = await res.json();
    const logs = await listRecentWebhookIngestLogs(tenant.id, 5);

    expect(res.status).toBe(200);
    expect(json.data.deliveryId).toMatch(/^diagnostic-/);
    expect(logs[0]).toMatchObject({
      source: "woocommerce",
      outcome: "diagnostic_200",
      httpStatus: 200,
    });
  });

  it("rejects WooCommerce webhook sync until the tenant has a webhook secret", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://oms.example.test";
    const tenant = await createTenantRecord("Missing Woo Secret Co");
    await setTenantWooCommerceRestFields(tenant.id, {
      storeUrl: "https://shop.example.test",
      consumerKey: "ck_test",
      consumerSecret: "cs_test",
    });

    const res = await syncWooCommerceWebhooks(
      new Request("https://oms.example.test/api/settings/woocommerce/webhooks/sync", {
        method: "POST",
        headers: {
          authorization: `Bearer ${tenant.staffApiKey}`,
          "x-tenant-id": tenant.id,
          "x-user-id": "admin-1",
          "x-user-role": "admin",
        },
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("WooCommerce webhook secret is required.");
  });

  it("syncs active WooCommerce order webhooks through REST credentials", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://oms.example.test";
    const tenant = await createTenantRecord("Webhook Sync Co");
    await setTenantWooCommerceWebhookSecret(tenant.id, "woo-secret");
    await setTenantWooCommerceRestFields(tenant.id, {
      storeUrl: "https://shop.example.test",
      consumerKey: "ck_test",
      consumerSecret: "cs_test",
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockImplementation(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          name: string;
          topic: string;
          delivery_url: string;
        };
        return new Response(
          JSON.stringify({
            id: body.topic === "order.created" ? 101 : 102,
            name: body.name,
            status: "active",
            topic: body.topic,
            delivery_url: body.delivery_url,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      });
    vi.stubGlobal("fetch", fetchMock);

    const res = await syncWooCommerceWebhooks(
      new Request("https://oms.example.test/api/settings/woocommerce/webhooks/sync", {
        method: "POST",
        headers: {
          authorization: `Bearer ${tenant.staffApiKey}`,
          "x-tenant-id": tenant.id,
          "x-user-id": "admin-1",
          "x-user-role": "admin",
        },
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.deliveryUrl).toBe(
      "https://oms.example.test/api/webhooks/woocommerce?tenant=webhook-sync-co",
    );
    expect(json.data.results).toEqual([
      expect.objectContaining({ topic: "order.created", action: "created" }),
      expect.objectContaining({ topic: "order.updated", action: "created" }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const createdBody = JSON.parse(
      String(fetchMock.mock.calls[1]?.[1]?.body ?? "{}"),
    ) as { secret?: string; delivery_url?: string };
    expect(createdBody.secret).toBe("woo-secret");
    expect(createdBody.delivery_url).toBe(json.data.deliveryUrl);
  });
});
