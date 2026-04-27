import { describe, expect, it } from "vitest";
import {
  buildOrderStatusWebhookPayload,
  signWebhookBody,
  webhooksForStatus,
} from "./outbound-webhooks.service";
import type { Order, TenantOutboundWebhook } from "@/lib/types/models";

const order: Order = {
  id: "order-1",
  tenantId: "tenant-1",
  customer: { name: "Ahmed", phone: "0100" },
  payment: {
    payment_status: "cod",
    total_amount: 100,
    paid_amount: 0,
    remaining_amount: 100,
    cod_amount: 100,
  },
  status: "confirmed",
  shipmentIds: [],
  woocommerceOrderSnapshot: { id: 123, status: "processing" },
  createdAt: "2026-04-20T10:00:00.000Z",
  updatedAt: "2026-04-27T18:00:00.000Z",
};

describe("outbound order status webhooks", () => {
  it("selects enabled webhooks that listen to the target status", () => {
    const webhooks: TenantOutboundWebhook[] = [
      {
        id: "enabled",
        name: "Enabled",
        enabled: true,
        url: "https://example.com/a",
        statuses: ["confirmed"],
      },
      {
        id: "disabled",
        name: "Disabled",
        enabled: false,
        url: "https://example.com/b",
        statuses: ["confirmed"],
      },
      {
        id: "other-status",
        name: "Other status",
        enabled: true,
        url: "https://example.com/c",
        statuses: ["cancelled"],
      },
    ];

    expect(webhooksForStatus(webhooks, "confirmed").map((w) => w.id)).toEqual([
      "enabled",
    ]);
  });

  it("omits WooCommerce snapshot unless explicitly included", () => {
    const payload = buildOrderStatusWebhookPayload({
      tenantId: "tenant-1",
      order,
      fromStatus: "pending_confirmation",
      toStatus: "confirmed",
      actorUserId: "user-1",
      includeOrderSnapshot: false,
    });

    expect(payload.event).toBe("order.status_changed");
    expect(payload.order.woocommerceOrderSnapshot).toBeUndefined();
  });

  it("signs payloads with a sha256 HMAC header value", () => {
    expect(signWebhookBody('{"ok":true}', "secret")).toBe(
      "sha256=f6b4a2841c93f8bf2fb8f2c13d8fb0b6c8e8019f09ee405d248daa8385fad638",
    );
  });
});
