import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import type {
  Order,
  OrderStatus,
  PaymentStatus,
  Shipment,
  ShipmentStatus,
  UserRole,
} from "@/lib/types/models";
import {
  decodeOrderCursor,
  encodeOrderCursor,
  MAX_ORDER_PAGE_SIZE,
  safeOrderPageSize,
} from "@/lib/db/order-pagination";
import {
  findFirstOrderByTenantAndExternalWooId,
  getFullOrderDoc,
  queryOrderByDocId,
  queryOrderByTenantAndField,
  queryOrdersListPage,
  queryRecentOrderSummaries,
  setOrderDoc,
  updateOrderDoc,
} from "@/lib/repositories/orders.repository";
import { getServerEnv } from "@/lib/config/env";
import { orderIngestFingerprint } from "@/lib/logic/order-ingest-fingerprint";
import { storeWooOrderWebhookSnapshot } from "@/lib/services/webhook-order-snapshot.service";
import { appendOrderEvent } from "@/lib/services/order-events.service";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockListOrders,
  mockGetOrder,
  mockUpsertOrderFromWooCommerce,
  mockConfirmOrder,
  mockInvoiceOrder,
  mockCancelOrder,
  mockAssignOrder,
  mockRevertOrder,
  mockDeleteOrder,
} from "@/lib/dev/mock-backend";
import {
  assertTransitionAllowed,
  TransitionBlockedError,
} from "@/lib/logic/order-state-machine";
import { assertWarehouseRevert } from "@/lib/logic/order-state-machine-warehouse";
import { statusRequiresTicket } from "@/lib/logic/order-status-meta";
import { createTicket } from "@/lib/services/tickets.service";
import {
  shouldAutoCreateShipment,
  orderNeedsDeliveryShipment,
} from "@/lib/logic/automation";
import { getTenantAutomation } from "@/lib/services/tenant-settings.service";
import {
  createShipmentForOrder,
  listShipmentsForOrder,
} from "@/lib/services/shipments.service";
import { dispatchOrderStatusWebhooks } from "@/lib/services/outbound-webhooks.service";
import {
  logActivity,
  logOrderStatusChange,
} from "@/lib/services/activity.service";
import {
  applyOrderStageRollupDelta,
  orderValueForStageRollup,
} from "@/lib/services/order-stage-rollup.service";
import { incrementUserStat } from "@/lib/services/user-stats.service";
import {
  recordNewOrderAnalytics,
  recordOrderConfirmedAnalytics,
  recordOrderDeletedAnalytics,
} from "@/lib/services/analytics-daily.service";
import { enqueueSyncOrderStatusToWooCommerce } from "@/lib/services/woocommerce-sync.service";
import { buildPayment } from "@/lib/logic/payment";

export type ListOrdersPageOptions = {
  status?: OrderStatus | OrderStatus[];
  payment?: PaymentStatus;
  /** Filter by latestShipmentStatus on the order doc (cached read field). */
  shipping?: ShipmentStatus;
  assignedTo?: string;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  cursor?: string;
};

export type OrdersPageResult = {
  data: Order[];
  pageInfo: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

/** List views should not load large Woo snapshot payloads. */
export function omitWooSnapshotForList(o: Order): Order {
  if (o.woocommerceOrderSnapshot === undefined) return o;
  const rest = { ...o };
  delete rest.woocommerceOrderSnapshot;
  return rest as Order;
}

function paymentUpdateForConfirmation(
  order: Order,
  paidAmount: number | undefined,
): Pick<Order, "payment"> | undefined {
  if (order.payment.payment_status !== "partial") return undefined;
  if (paidAmount === undefined) {
    throw new Error("Paid amount is required for partial orders");
  }
  if (!Number.isFinite(paidAmount)) {
    throw new Error("Paid amount must be a valid number");
  }
  if (paidAmount < 0) {
    throw new Error("Paid amount cannot be negative");
  }
  if (paidAmount > order.payment.total_amount) {
    throw new Error("Paid amount cannot exceed order total");
  }
  return {
    payment: buildPayment({
      payment_status: "partial",
      total_amount: order.payment.total_amount,
      paid_amount: paidAmount,
    }),
  };
}

function dateStartIso(date: string) {
  return `${date}T00:00:00.000Z`;
}

function dateEndIso(date: string) {
  return `${date}T23:59:59.999Z`;
}

function orderMatchesPageFilters(order: Order, opts?: ListOrdersPageOptions) {
  const statuses = Array.isArray(opts?.status)
    ? opts.status.filter(Boolean)
    : opts?.status
      ? [opts.status]
      : [];
  if (statuses.length > 0 && !statuses.includes(order.status)) return false;
  if (opts?.payment && order.payment.payment_status !== opts.payment) return false;
  if (opts?.shipping && order.latestShipmentStatus !== opts.shipping) return false;
  if (opts?.assignedTo && order.assigned_to !== opts.assignedTo) return false;
  if (opts?.from && order.createdAt < dateStartIso(opts.from)) return false;
  if (opts?.to && order.createdAt > dateEndIso(opts.to)) return false;
  return true;
}

async function searchOrdersPage(
  tenantId: string,
  search: string,
  opts: ListOrdersPageOptions | undefined,
  limit: number,
): Promise<OrdersPageResult> {
  const needle = search.trim();
  if (!needle) return listOrdersPage(tenantId, { ...opts, search: undefined, limit });

  if (isDevMockDataEnabled()) {
    const n = needle.toLowerCase();
    const rows = mockListOrders(tenantId)
      .filter((order) => orderMatchesPageFilters(order, opts))
      .filter((order) =>
        [
          order.id,
          order.wooCommerceOrderId,
          order.customer.phone,
          order.customer.email,
          order.customer.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(n),
      )
      .slice(0, limit);
    return {
      data: rows.map(omitWooSnapshotForList),
      pageInfo: { nextCursor: null, hasMore: false },
    };
  }

  const found = new Map<string, Order>();
  const directOrder = await queryOrderByDocId(needle);
  if (directOrder?.tenantId === tenantId) {
    found.set(directOrder.id, omitWooSnapshotForList(directOrder));
  }

  const equalityFields = [
    "wooCommerceOrderId",
    "externalOrderId",
    "customer.phone",
    "customer.email",
  ] as const;
  await Promise.all(
    equalityFields.map(async (field) => {
      const rows = await queryOrderByTenantAndField(tenantId, field, needle, limit);
      for (const order of rows) {
        found.set(order.id, omitWooSnapshotForList(order));
      }
    }),
  );

  const rows = [...found.values()]
    .filter((order) => orderMatchesPageFilters(order, opts))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, limit);
  return {
    data: rows.map(omitWooSnapshotForList),
    pageInfo: { nextCursor: null, hasMore: false },
  };
}

export async function listOrdersPage(
  tenantId: string,
  opts?: ListOrdersPageOptions,
): Promise<OrdersPageResult> {
  const safeLimit = safeOrderPageSize(opts?.limit);
  if (opts?.search?.trim()) {
    return searchOrdersPage(tenantId, opts.search, opts, safeLimit);
  }
  const statuses = Array.isArray(opts?.status)
    ? opts.status.filter(Boolean)
    : opts?.status
      ? [opts.status]
      : [];

  if (isDevMockDataEnabled()) {
    const all = mockListOrders(tenantId, {
      status: statuses.length === 1 ? statuses[0] : undefined,
      assignedTo: opts?.assignedTo,
      from: opts?.from,
      to: opts?.to,
    })
      .filter((order) => statuses.length === 0 || statuses.includes(order.status))
      .filter((order) => !opts?.payment || order.payment.payment_status === opts.payment)
      .filter((order) => !opts?.shipping || order.latestShipmentStatus === opts.shipping)
      .sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      );
    const cursor = decodeOrderCursor(opts?.cursor);
    const startIndex = cursor
      ? all.findIndex(
          (order) => order.createdAt === cursor.createdAt && order.id === cursor.id,
        ) + 1
      : 0;
    const rows = all.slice(Math.max(startIndex, 0), Math.max(startIndex, 0) + safeLimit + 1);
    const page = rows.slice(0, safeLimit);
    const last = page.at(-1);
    return {
      data: page.map(omitWooSnapshotForList),
      pageInfo: {
        hasMore: rows.length > safeLimit,
        nextCursor:
          rows.length > safeLimit && last
            ? encodeOrderCursor({ createdAt: last.createdAt, id: last.id })
            : null,
      },
    };
  }

  const cursor = decodeOrderCursor(opts?.cursor);
  const rows = await queryOrdersListPage(
    tenantId,
    {
      statuses,
      payment: opts?.payment,
      shipping: opts?.shipping,
      assignedTo: opts?.assignedTo,
      from: opts?.from,
      to: opts?.to,
    },
    safeLimit + 1,
    cursor,
  ).then((list) => list.map(omitWooSnapshotForList));
  const page = rows.slice(0, safeLimit);
  const last = page.at(-1);
  return {
    data: page,
    pageInfo: {
      hasMore: rows.length > safeLimit,
      nextCursor:
        rows.length > safeLimit && last
          ? encodeOrderCursor({ createdAt: last.createdAt, id: last.id })
          : null,
    },
  };
}

export async function listOrders(
  tenantId: string,
  opts?: ListOrdersPageOptions,
): Promise<Order[]> {
  const page = await listOrdersPage(tenantId, {
    ...opts,
    limit: opts?.limit ?? MAX_ORDER_PAGE_SIZE,
  });
  return page.data;
}

export async function countOrders(
  tenantId: string,
  opts?: Pick<ListOrdersPageOptions, "status" | "payment" | "assignedTo" | "from" | "to">,
): Promise<number> {
  if (isDevMockDataEnabled()) {
    return mockListOrders(tenantId, {
      status: Array.isArray(opts?.status) ? undefined : opts?.status,
      assignedTo: opts?.assignedTo,
      from: opts?.from,
      to: opts?.to,
    })
      .filter((order) => orderMatchesPageFilters(order, opts))
      .length;
  }
  const statuses = Array.isArray(opts?.status)
    ? opts.status.filter(Boolean)
    : opts?.status
      ? [opts.status]
      : [];
  let q = getSupabaseServiceRoleClient()
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (statuses.length === 1) q = q.eq("status", statuses[0]);
  else if (statuses.length > 1) q = q.in("status", statuses.slice(0, 10));
  if (opts?.payment) q = q.eq("payment->>payment_status", opts.payment);
  if (opts?.assignedTo) q = q.eq("assigned_to", opts.assignedTo);
  if (opts?.from) q = q.gte("created_at", dateStartIso(opts.from));
  if (opts?.to) q = q.lte("created_at", dateEndIso(opts.to));
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function listRecentOrders(
  tenantId: string,
  limitCount = 10,
): Promise<Order[]> {
  const numericLimit = Number.isFinite(limitCount) ? limitCount : 10;
  const safeLimit = Math.min(Math.max(Math.floor(numericLimit), 1), 20);
  if (isDevMockDataEnabled()) {
    return mockListOrders(tenantId).slice(0, safeLimit).map(omitWooSnapshotForList);
  }
  const rows = await queryRecentOrderSummaries(tenantId, safeLimit);
  return rows.map(omitWooSnapshotForList);
}

export async function getOrder(
  tenantId: string,
  orderId: string,
): Promise<Order | null> {
  if (isDevMockDataEnabled()) return mockGetOrder(tenantId, orderId);
  return getFullOrderDoc(tenantId, orderId);
}

export async function getOrderDetailBundle(
  tenantId: string,
  orderId: string,
): Promise<{ order: Order; shipments: Shipment[] } | null> {
  const order = await getOrder(tenantId, orderId);
  if (!order) return null;
  const shipments = await listShipmentsForOrder(tenantId, orderId);
  return { order, shipments };
}

/**
 * Previous / next order ids within the same lifecycle status, ordered like the
 * orders list (newest first by createdAt, then document id).
 * prevId = newer order (السابق), nextId = older order (التالي).
 */
export async function getOrderNeighborsSameStatus(
  tenantId: string,
  orderId: string,
): Promise<{ prevId: string | null; nextId: string | null } | null> {
  const order = await getOrder(tenantId, orderId);
  if (!order) return null;
  const id = order.id?.trim() || orderId;

  if (isDevMockDataEnabled()) {
    const rows = mockListOrders(tenantId)
      .filter((o) => o.status === order.status)
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      );
    const i = rows.findIndex((o) => o.id === id);
    if (i < 0) return null;
    return {
      prevId: i > 0 ? rows[i - 1]!.id : null,
      nextId: i < rows.length - 1 ? rows[i + 1]!.id : null,
    };
  }

  const rows = await listOrders(tenantId, {
    status: order.status,
    limit: MAX_ORDER_PAGE_SIZE,
  });
  const i = rows.findIndex((row) => row.id === id);
  if (i < 0) return null;
  return {
    prevId: i > 0 ? rows[i - 1]!.id : null,
    nextId: i < rows.length - 1 ? rows[i + 1]!.id : null,
  };
}

export type WooCommerceUpsertOutcome = "created" | "updated" | "unchanged";

export type WooCommerceUpsertResult = {
  order: Order;
  outcome: WooCommerceUpsertOutcome;
};

export async function upsertOrderFromWooCommerce(input: {
  tenantId: string;
  wooOrderId: string;
  customer: Order["customer"];
  payment: Order["payment"];
  actorUserId: string;
  lineItems?: Order["lineItems"];
  shipping?: Order["shipping"];
  notes?: string;
  /** Full parsed WooCommerce order object (e.g. webhook `POST` body). */
  woocommerceOrderSnapshot?: unknown;
  /** مطلوب لتخزين اللقطة الخام في المجموعة الفرعية عند تفعيل البيئة. */
  deliveryId?: string;
}): Promise<WooCommerceUpsertResult> {
  if (isDevMockDataEnabled()) return mockUpsertOrderFromWooCommerce(input);

  const env = getServerEnv();
  const storeRaw =
    String(env.WOOCOMMERCE_STORE_RAW_PAYLOAD ?? "").trim() === "1";
  const now = new Date().toISOString();
  const fingerprint = orderIngestFingerprint({
    customer: input.customer,
    payment: input.payment,
    lineItems: input.lineItems,
    shipping: input.shipping,
    notes: input.notes,
  });
  const lineItemCount = input.lineItems?.length ?? 0;
  const source = "woocommerce" as const;
  const externalOrderId = input.wooOrderId;

  const found = await findFirstOrderByTenantAndExternalWooId(
    input.tenantId,
    input.wooOrderId,
  );

  if (found) {
    const { data: prev } = found;
    const id = prev.id?.trim() || found.id;

    /** نفس البيانات بعد التطبيع — تحديث وقت المزامنة فقط بدون سجلات مكررة. */
    if (prev.lastWebhookSyncFingerprint === fingerprint) {
      await updateOrderDoc(id, { lastSyncedAt: now, updatedAt: now });
      const fresh = await getFullOrderDoc(input.tenantId, id);
      if (!fresh) throw new Error("Order not found");
      return { order: fresh, outcome: "unchanged" };
    }

    const paymentLocked = prev.status !== "pending_confirmation";

    let webhookPayloadRef: string | undefined;
    if (
      storeRaw &&
      input.woocommerceOrderSnapshot != null &&
      input.deliveryId?.trim()
    ) {
      webhookPayloadRef = await storeWooOrderWebhookSnapshot({
        tenantId: input.tenantId,
        orderId: id,
        deliveryId: input.deliveryId.trim(),
        payload: input.woocommerceOrderSnapshot,
      });
    }

    const patch: Record<string, unknown> = {
      customer: input.customer,
      lineItems: input.lineItems ?? prev.lineItems,
      shipping: input.shipping ?? prev.shipping,
      notes: input.notes ?? prev.notes,
      lineItemCount,
      externalOrderId,
      source,
      lastSyncedAt: now,
      updatedAt: now,
      lastWebhookSyncFingerprint: fingerprint,
      woocommerceOrderSnapshot: null,
    };
    if (!paymentLocked) {
      patch.payment = input.payment;
    }
    if (storeRaw && webhookPayloadRef) {
      patch.webhookPayloadRef = webhookPayloadRef;
    } else {
      patch.webhookPayloadRef = null;
    }

    await updateOrderDoc(id, patch);

    await logActivity({
      tenantId: input.tenantId,
      action: "order.upsert_webhook",
      entityType: "order",
      entityId: id,
      userId: input.actorUserId,
      metadata: { deliveryId: input.deliveryId, fingerprint },
    });
    await appendOrderEvent({
      tenantId: input.tenantId,
      orderId: id,
      action: "order.ingest.updated",
      userId: input.actorUserId,
      metadata: {
        deliveryId: input.deliveryId,
        fingerprint,
        wooOrderId: input.wooOrderId,
      },
    });

    const fresh = await getFullOrderDoc(input.tenantId, id);
    if (!fresh) throw new Error("Order not found");
    return { order: fresh, outcome: "updated" };
  }

  const id = crypto.randomUUID();
  let webhookPayloadRef: string | undefined;
  if (
    storeRaw &&
    input.woocommerceOrderSnapshot != null &&
    input.deliveryId?.trim()
  ) {
    webhookPayloadRef = await storeWooOrderWebhookSnapshot({
      tenantId: input.tenantId,
      orderId: id,
      deliveryId: input.deliveryId.trim(),
      payload: input.woocommerceOrderSnapshot,
    });
  }

  const order: Order = {
    id,
    tenantId: input.tenantId,
    customer: input.customer,
    payment: input.payment,
    status: "pending_confirmation",
    shipmentIds: [],
    wooCommerceOrderId: input.wooOrderId,
    externalOrderId,
    source,
    lastSyncedAt: now,
    lineItemCount,
    lineItems: input.lineItems,
    shipping: input.shipping,
    notes: input.notes,
    webhookPayloadRef,
    lastWebhookSyncFingerprint: fingerprint,
    createdAt: now,
    updatedAt: now,
  };

  await setOrderDoc(id, order);
  await applyOrderStageRollupDelta({
    tenantId: input.tenantId,
    from: null,
    to: "pending_confirmation",
    orderValue: orderValueForStageRollup(order),
  });
  await logActivity({
    tenantId: input.tenantId,
    action: "order.created_webhook",
    entityType: "order",
    entityId: id,
    userId: input.actorUserId,
    metadata: { deliveryId: input.deliveryId, fingerprint },
  });
  await appendOrderEvent({
    tenantId: input.tenantId,
    orderId: id,
    action: "order.ingest.created",
    userId: input.actorUserId,
    metadata: {
      deliveryId: input.deliveryId,
      fingerprint,
      wooOrderId: input.wooOrderId,
    },
  });
  await recordNewOrderAnalytics(order);
  return { order, outcome: "created" };
}

type TransitionOptions = {
  /** Optional free-form note (cancel reason, return reason, etc.). */
  note?: string;
  /** Role of the actor — recorded in the activity log metadata. */
  role?: UserRole;
  /** Extra Order fields to merge alongside the status change. */
  extra?: Partial<Order>;
  /** Skip the FSM allow-list check (used by warehouse revert flow). */
  skipFsmCheck?: boolean;
  /** Skip auto-ticket creation (used when the caller already created one). */
  skipTicketCreation?: boolean;
};

/**
 * Single source of truth for forward order-status changes.
 *
 * منطق الـ transition:
 * 1. assertTransitionAllowed — FSM + invoice + AWB
 * 2. ticket auto-create — `returned` / `exchange_requested`
 * 3. update Supabase (status + statusUpdatedAt + extras)
 * 4. rollup delta + structured activity log
 * 5. side-effects: auto-shipment, Woo sync, outbound webhooks
 */
async function transition(
  tenantId: string,
  orderId: string,
  to: OrderStatus,
  actorUserId: string,
  opts: TransitionOptions = {},
) {
  const order = await getFullOrderDoc(tenantId, orderId);
  if (!order) throw new Error("Order not found");
  if (opts.skipFsmCheck !== true) {
    assertTransitionAllowed(order, to);
  }

  // قبل ما نغير الحالة لو كانت returned/exchange_requested، لازم نفتح تذكرة دعم.
  if (
    !opts.skipTicketCreation &&
    statusRequiresTicket(to) &&
    order.status !== to
  ) {
    const kind = statusRequiresTicket(to);
    if (kind) {
      try {
        await createTicket({
          tenantId,
          order_id: orderId,
          type: kind,
          actorUserId,
          notes: opts.note,
        });
      } catch (err) {
        // Ticket creation is best-effort; fail loud only if it's a hard error.
        if ((err as { status?: number }).status === 403) throw err;
      }
    }
  }

  const now = new Date().toISOString();
  const prevStatus = order.status;

  /** تحديث جزئي — لا نعيد كتابة المستند بالكامل عند تغيير الحالة فقط. */
  const updatePayload: Record<string, unknown> = {
    status: to,
    statusUpdatedAt: now,
    updatedAt: now,
  };
  if (opts.extra) {
    for (const [k, v] of Object.entries(opts.extra)) {
      if (
        v !== undefined &&
        k !== "id" &&
        k !== "tenantId" &&
        k !== "status"
      ) {
        updatePayload[k] = v;
      }
    }
  }
  await updateOrderDoc(orderId, updatePayload);

  const next = await getFullOrderDoc(tenantId, orderId);
  if (!next) throw new Error("Order not found");

  await applyOrderStageRollupDelta({
    tenantId,
    from: prevStatus,
    to,
    orderValue: orderValueForStageRollup(order),
  });

  await logOrderStatusChange({
    tenantId,
    orderId,
    userId: actorUserId,
    fromStatus: prevStatus,
    toStatus: to,
    role: opts.role ?? "admin",
    note: opts.note,
  });

  await appendOrderEvent({
    tenantId,
    orderId,
    action: `order.status.${to}`,
    userId: actorUserId,
    metadata: {
      from: prevStatus,
      to,
      role: opts.role ?? "admin",
      ...(opts.note?.trim() ? { note: opts.note.trim().slice(0, 2000) } : {}),
    },
  });

  const automation = await getTenantAutomation(tenantId);
  if (
    shouldAutoCreateShipment(prevStatus, to, automation) &&
    orderNeedsDeliveryShipment(next)
  ) {
    await createShipmentForOrder({
      tenantId,
      orderId,
      type: "delivery",
      actorUserId,
    });
  }

  enqueueSyncOrderStatusToWooCommerce({
    tenantId,
    order: next,
    actorUserId,
  });

  await dispatchOrderStatusWebhooks({
    tenantId,
    order: next,
    fromStatus: prevStatus,
    toStatus: to,
    actorUserId,
  });

  return { prevStatus, order: next };
}

/**
 * Public entry point for status transitions triggered by UI actions
 * (drag-drop, action buttons, table row menu).
 *
 * Re-throws `TransitionBlockedError` so the API layer can map them to a
 * 422 with the structured `{ reason, requiredRole, missingInvoice, missingAwb }`
 * payload the UI uses to show Arabic explanations.
 */
export async function transitionOrder(input: {
  tenantId: string;
  orderId: string;
  toStatus: OrderStatus;
  actorUserId: string;
  role?: UserRole;
  note?: string;
}): Promise<Order> {
  if (isDevMockDataEnabled()) {
    const prev = mockGetOrder(input.tenantId, input.orderId);
    if (!prev) throw new Error("Order not found");
    assertTransitionAllowed(prev, input.toStatus);
    if (
      statusRequiresTicket(input.toStatus) &&
      prev.status !== input.toStatus
    ) {
      const kind = statusRequiresTicket(input.toStatus);
      if (kind) {
        try {
          await createTicket({
            tenantId: input.tenantId,
            order_id: input.orderId,
            type: kind,
            actorUserId: input.actorUserId,
            notes: input.note,
          });
        } catch (err) {
          if ((err as { status?: number }).status === 403) throw err;
        }
      }
    }
    const { mockTransition } = await import("@/lib/dev/mock-backend");
    const { order } = await mockTransition(
      input.tenantId,
      input.orderId,
      input.toStatus,
      input.actorUserId,
      undefined,
      {
        role: input.role ?? "admin",
        ...(input.note?.trim() ? { note: input.note.trim().slice(0, 2000) } : {}),
      },
    );
    await dispatchOrderStatusWebhooks({
      tenantId: input.tenantId,
      order,
      fromStatus: prev.status,
      toStatus: order.status,
      actorUserId: input.actorUserId,
    });
    return order;
  }
  const { order } = await transition(
    input.tenantId,
    input.orderId,
    input.toStatus,
    input.actorUserId,
    {
      role: input.role,
      note: input.note,
    },
  );
  return order;
}

export { TransitionBlockedError };

export async function confirmOrder(input: {
  tenantId: string;
  orderId: string;
  actorUserId: string;
  paidAmount?: number;
}) {
  if (isDevMockDataEnabled()) {
    const prev = mockGetOrder(input.tenantId, input.orderId);
    const order = await mockConfirmOrder(input);
    if (prev) {
      await dispatchOrderStatusWebhooks({
        tenantId: input.tenantId,
        order,
        fromStatus: prev.status,
        toStatus: order.status,
        actorUserId: input.actorUserId,
      });
    }
    return order;
  }
  const current = await getOrder(input.tenantId, input.orderId);
  if (!current) throw new Error("Order not found");
  const paymentExtra = paymentUpdateForConfirmation(current, input.paidAmount);
  const { order } = await transition(
    input.tenantId,
    input.orderId,
    "confirmed",
    input.actorUserId,
    {
      role: "confirmation",
      extra: paymentExtra,
    },
  );
  await incrementUserStat({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    field: "confirmed",
  });
  await recordOrderConfirmedAnalytics({
    tenantId: input.tenantId,
    atIso: order.updatedAt,
  });
  return order;
}

export async function invoiceOrder(input: {
  tenantId: string;
  orderId: string;
  invoiceNumber: string;
  actorUserId: string;
}) {
  if (isDevMockDataEnabled()) {
    const prev = mockGetOrder(input.tenantId, input.orderId);
    const order = await mockInvoiceOrder(input);
    if (prev) {
      await dispatchOrderStatusWebhooks({
        tenantId: input.tenantId,
        order,
        fromStatus: prev.status,
        toStatus: order.status,
        actorUserId: input.actorUserId,
      });
    }
    return order;
  }
  let current = await getFullOrderDoc(input.tenantId, input.orderId);
  if (!current) {
    throw new Error("Order not found");
  }

  const invoice = {
    number: input.invoiceNumber,
    issuedAt: new Date().toISOString(),
  };

  // فلو الفوترة الجديد:
  // confirmed → invoice_required → invoiced
  // (بدون قفزة تلقائية لـ ready_for_shipping؛ ده بيتعمل من زر "تجهيز للشحن" منفصل).
  if (current.status === "confirmed") {
    const reqResult = await transition(
      input.tenantId,
      input.orderId,
      "invoice_required",
      input.actorUserId,
      { role: "confirmation" },
    );
    current = reqResult.order;
  }

  if (current.status !== "invoice_required") {
    throw new Error(`Cannot invoice from status ${current.status}`);
  }

  const { order: final } = await transition(
    input.tenantId,
    input.orderId,
    "invoiced",
    input.actorUserId,
    {
      role: "invoicing",
      extra: { invoice },
    },
  );

  await incrementUserStat({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    field: "invoiced",
  });

  return final;
}

export async function cancelOrder(input: {
  tenantId: string;
  orderId: string;
  actorUserId: string;
  reason: string;
}) {
  if (isDevMockDataEnabled()) {
    const prev = mockGetOrder(input.tenantId, input.orderId);
    const order = await mockCancelOrder(input);
    if (prev) {
      await dispatchOrderStatusWebhooks({
        tenantId: input.tenantId,
        order,
        fromStatus: prev.status,
        toStatus: order.status,
        actorUserId: input.actorUserId,
      });
    }
    return order;
  }
  const { order } = await transition(
    input.tenantId,
    input.orderId,
    "cancelled",
    input.actorUserId,
    {
      note: input.reason,
      role: "confirmation",
      extra: {
        cancelReason: input.reason,
        cancelledAt: new Date().toISOString(),
        cancelledByUserId: input.actorUserId,
      },
    },
  );
  return order;
}

export async function deleteOrder(input: {
  tenantId: string;
  orderId: string;
  actorUserId: string;
}): Promise<{
  orderId: string;
  deletedShipmentIds: string[];
  deletedTicketIds: string[];
}> {
  if (isDevMockDataEnabled()) return mockDeleteOrder(input);

  const supabase = getSupabaseServiceRoleClient();
  const order = await getFullOrderDoc(input.tenantId, input.orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  const [shipments, tickets] = await Promise.all([
    supabase
      .from("shipments")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("order_id", input.orderId),
    supabase
      .from("tickets")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("order_id", input.orderId),
  ]);
  if (shipments.error) throw shipments.error;
  if (tickets.error) throw tickets.error;

  const deletedShipmentIds = (shipments.data ?? []).map((row) => row.id);
  const deletedTicketIds = (tickets.data ?? []).map((row) => row.id);
  const { error: deleteError } = await supabase
    .from("orders")
    .delete()
    .eq("id", input.orderId)
    .eq("tenant_id", input.tenantId);
  if (deleteError) throw deleteError;
  await logActivity({
    tenantId: input.tenantId,
    action: "order.deleted",
    entityType: "order",
    entityId: input.orderId,
    userId: input.actorUserId,
    metadata: {
      status: order.status,
      wooCommerceOrderId: order.wooCommerceOrderId,
      customerName: order.customer.name,
      totalAmount: order.payment.total_amount,
      deletedShipmentIds,
      deletedTicketIds,
    },
  });
  await applyOrderStageRollupDelta({
    tenantId: input.tenantId,
    from: order.status,
    to: null,
    orderValue: orderValueForStageRollup(order),
  });
  await recordOrderDeletedAnalytics(order);

  return {
    orderId: input.orderId,
    deletedShipmentIds,
    deletedTicketIds,
  };
}

export async function assignOrder(input: {
  tenantId: string;
  orderId: string;
  assigneeUserId: string | null;
  actorUserId: string;
}) {
  if (isDevMockDataEnabled()) return mockAssignOrder(input);
  const order = await getFullOrderDoc(input.tenantId, input.orderId);
  if (!order) throw new Error("Order not found");
  const now = new Date().toISOString();
  await updateOrderDoc(input.orderId, {
    assigned_to: input.assigneeUserId,
    updatedAt: now,
  });
  const next: Order = {
    ...order,
    assigned_to: input.assigneeUserId,
    updatedAt: now,
  };
  await logActivity({
    tenantId: input.tenantId,
    action: "order.assigned",
    entityType: "order",
    entityId: input.orderId,
    userId: input.actorUserId,
    metadata: { assigneeUserId: input.assigneeUserId },
  });
  return next;
}

/**
 * Return order one stage back (warehouse flow). `to` is validated from current status.
 *
 * مسارات الرجوع المسموح بها (warehouse only):
 * - awb_created       → ready_for_shipping
 * - warehouse_picking → awb_created
 * - warehouse_packed  → awb_created | warehouse_picking
 */
export async function revertOrderStage(input: {
  tenantId: string;
  orderId: string;
  to: "ready_for_shipping" | "awb_created" | "warehouse_picking";
  reason: string;
  actorUserId: string;
}): Promise<Order> {
  const reason = input.reason.trim();
  if (!reason) {
    const e = new Error("السبب مطلوب") as Error & { status: number };
    e.status = 400;
    throw e;
  }
  if (isDevMockDataEnabled()) {
    const prev = mockGetOrder(input.tenantId, input.orderId);
    const order = mockRevertOrder({
      ...input,
      to: input.to,
    });
    if (prev) {
      await dispatchOrderStatusWebhooks({
        tenantId: input.tenantId,
        order,
        fromStatus: prev.status,
        toStatus: order.status,
        actorUserId: input.actorUserId,
      });
    }
    return order;
  }

  const order = await getFullOrderDoc(input.tenantId, input.orderId);
  if (!order) throw new Error("Order not found");
  assertWarehouseRevert(order.status, input.to);
  const from = order.status;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.to,
    updatedAt: now,
  };

  if (
    (from === "warehouse_packed" || from === "warehouse_picking") &&
    (input.to === "awb_created" || input.to === "warehouse_picking")
  ) {
    const { data: shipment } = await getSupabaseServiceRoleClient()
      .from("shipments")
      .select("*")
      .eq("tenant_id", input.tenantId)
      .eq("order_id", input.orderId)
      .eq("type", "delivery")
      .limit(1)
      .maybeSingle();
    if (shipment) {
      await getSupabaseServiceRoleClient()
        .from("shipments")
        .update({
          status: "created",
          packed_at: null,
          shipped_at: null,
        })
        .eq("id", shipment.id);
      patch.latestShipmentAwb = shipment.awb;
      patch.latestShipmentCarrierTrackingStatus =
        shipment.carrier_tracking_status ?? null;
      patch.latestShipmentStatus = "created";
    }
  }

  await updateOrderDoc(input.orderId, patch);
  const next = await getFullOrderDoc(input.tenantId, input.orderId);
  if (!next) throw new Error("Order not found");
  const result = { from, next };

  await applyOrderStageRollupDelta({
    tenantId: input.tenantId,
    from: result.from,
    to: result.next.status,
    orderValue: orderValueForStageRollup(result.next),
  });

  await logActivity({
    tenantId: input.tenantId,
    action: "order.revert",
    entityType: "order",
    entityId: input.orderId,
    userId: input.actorUserId,
    metadata: {
      from: result.from,
      to: result.next.status,
      reason: reason.slice(0, 2000),
    },
  });

  enqueueSyncOrderStatusToWooCommerce({
    tenantId: input.tenantId,
    order: result.next,
    actorUserId: input.actorUserId,
  });

  await dispatchOrderStatusWebhooks({
    tenantId: input.tenantId,
    order: result.next,
    fromStatus: result.from,
    toStatus: result.next.status,
    actorUserId: input.actorUserId,
  });

  return result.next;
}
