import { createHmac } from "crypto";
import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  getTenantAutomation,
} from "@/lib/services/tenant-settings.service";
import type {
  Order,
  OrderStatus,
  OutboundWebhookDeliveryLog,
  TenantOutboundWebhook,
} from "@/lib/types/models";

const EVENT_NAME = "order.status_changed" as const;
const DELIVERY_TIMEOUT_MS = 5000;

export type OrderStatusWebhookPayload = {
  event: typeof EVENT_NAME;
  tenantId: string;
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  changedAt: string;
  actorUserId: string;
  order: Order;
};

export function webhooksForStatus(
  webhooks: TenantOutboundWebhook[] | undefined,
  status: OrderStatus,
) {
  return (webhooks ?? []).filter(
    (w) => w.enabled && w.url.trim() && w.statuses.includes(status),
  );
}

export function buildOrderStatusWebhookPayload(input: {
  tenantId: string;
  order: Order;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  actorUserId: string;
  includeOrderSnapshot: boolean;
}): OrderStatusWebhookPayload {
  const order = { ...input.order };
  if (!input.includeOrderSnapshot) {
    delete order.woocommerceOrderSnapshot;
  }
  return {
    event: EVENT_NAME,
    tenantId: input.tenantId,
    orderId: input.order.id,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    changedAt: input.order.updatedAt,
    actorUserId: input.actorUserId,
    order,
  };
}

export function signWebhookBody(body: string, secret: string) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

async function appendDeliveryLog(row: OutboundWebhookDeliveryLog) {
  if (isDevMockDataEnabled()) {
    const { mockAppendOutboundWebhookDeliveryLog } = await import(
      "@/lib/dev/mock-backend"
    );
    mockAppendOutboundWebhookDeliveryLog(row);
    return;
  }
  const db = getDb();
  await db.collection(COLLECTIONS.outboundWebhookLogs).doc(row.id).set(row);
}

async function deliverWebhook(input: {
  tenantId: string;
  webhook: TenantOutboundWebhook;
  order: Order;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  actorUserId: string;
}) {
  const now = new Date().toISOString();
  const payload = buildOrderStatusWebhookPayload({
    tenantId: input.tenantId,
    order: input.order,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actorUserId: input.actorUserId,
    includeOrderSnapshot: !!input.webhook.includeOrderSnapshot,
  });
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-OMS-Event": EVENT_NAME,
    "X-OMS-Webhook-Id": input.webhook.id,
  };
  if (input.webhook.secret?.trim()) {
    headers["X-OMS-Signature"] = signWebhookBody(
      body,
      input.webhook.secret.trim(),
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  let log: Omit<OutboundWebhookDeliveryLog, "id" | "createdAt">;
  try {
    const res = await fetch(input.webhook.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    log = {
      tenantId: input.tenantId,
      webhookId: input.webhook.id,
      webhookName: input.webhook.name,
      event: EVENT_NAME,
      orderId: input.order.id,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      success: res.ok,
      httpStatus: res.status,
      errorMessage: res.ok ? undefined : res.statusText || "HTTP error",
    };
  } catch (e) {
    log = {
      tenantId: input.tenantId,
      webhookId: input.webhook.id,
      webhookName: input.webhook.name,
      event: EVENT_NAME,
      orderId: input.order.id,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      success: false,
      errorMessage:
        e instanceof Error ? e.message.slice(0, 500) : "Webhook delivery failed",
    };
  } finally {
    clearTimeout(timeout);
  }

  await appendDeliveryLog({
    ...log,
    id: crypto.randomUUID(),
    createdAt: now,
  });
}

/**
 * Best-effort outbound notifications. This function intentionally swallows
 * errors so external platforms never block the OMS status transition.
 */
export async function dispatchOrderStatusWebhooks(input: {
  tenantId: string;
  order: Order;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  actorUserId: string;
}) {
  try {
    const automation = await getTenantAutomation(input.tenantId);
    const webhooks = webhooksForStatus(
      automation.outboundWebhooks,
      input.toStatus,
    );
    if (webhooks.length === 0) return;
    await Promise.allSettled(
      webhooks.map((webhook) =>
        deliverWebhook({
          ...input,
          webhook,
        }),
      ),
    );
  } catch {
    // Non-blocking by design. Delivery-level failures are logged when possible.
  }
}

export async function listOutboundWebhookDeliveryLogs(
  tenantId: string,
  limit = 25,
): Promise<OutboundWebhookDeliveryLog[]> {
  if (isDevMockDataEnabled()) {
    const { mockListOutboundWebhookDeliveryLogs } = await import(
      "@/lib/dev/mock-backend"
    );
    return mockListOutboundWebhookDeliveryLogs(tenantId, limit);
  }
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.outboundWebhookLogs)
    .where("tenantId", "==", tenantId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as OutboundWebhookDeliveryLog);
}
