import { FieldPath } from "firebase-admin/firestore";
import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import type { Order, OrderStatus, PaymentStatus, Shipment } from "@/lib/types/models";
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
import { assertTransition } from "@/lib/logic/order-state-machine";
import { assertWarehouseRevert } from "@/lib/logic/order-state-machine-warehouse";
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
import { logActivity } from "@/lib/services/activity.service";
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
import {
  cloneJsonForFirestore,
  omitUndefinedForFirestore,
} from "@/lib/util/json-snapshot";
import { enqueueSyncOrderStatusToWooCommerce } from "@/lib/services/woocommerce-sync.service";
import { buildPayment } from "@/lib/logic/payment";

const DEFAULT_ORDER_PAGE_SIZE = 25;
const MAX_ORDER_PAGE_SIZE = 50;

type OrderCursor = {
  createdAt: string;
  id: string;
};

export type ListOrdersPageOptions = {
  status?: OrderStatus | OrderStatus[];
  payment?: PaymentStatus;
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
function omitWooSnapshotForList(o: Order): Order {
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

function safeOrderPageSize(limit?: number) {
  const numericLimit = Number.isFinite(limit ?? NaN)
    ? Math.floor(limit as number)
    : DEFAULT_ORDER_PAGE_SIZE;
  return Math.min(Math.max(numericLimit, 1), MAX_ORDER_PAGE_SIZE);
}

function encodeOrderCursor(cursor: OrderCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeOrderCursor(cursor?: string): OrderCursor | null {
  if (!cursor?.trim()) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as Partial<OrderCursor>;
    if (typeof parsed.createdAt === "string" && typeof parsed.id === "string") {
      return { createdAt: parsed.createdAt, id: parsed.id };
    }
  } catch {
    return null;
  }
  return null;
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

  const db = getDb();
  const found = new Map<string, Order>();
  const direct = await db.collection(COLLECTIONS.orders).doc(needle).get();
  const directOrder = direct.data() as Order | undefined;
  if (directOrder?.tenantId === tenantId) {
    found.set(direct.id, { ...directOrder, id: directOrder.id || direct.id });
  }

  const equalityQueries = [
    ["wooCommerceOrderId", needle],
    ["customer.phone", needle],
    ["customer.email", needle],
  ] as const;
  await Promise.all(
    equalityQueries.map(async ([field, value]) => {
      const snap = await db
        .collection(COLLECTIONS.orders)
        .where("tenantId", "==", tenantId)
        .where(field, "==", value)
        .limit(limit)
        .get();
      for (const doc of snap.docs) {
        const order = doc.data() as Order;
        found.set(doc.id, { ...order, id: order.id || doc.id });
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

  const db = getDb();
  let q = db
    .collection(COLLECTIONS.orders)
    .where("tenantId", "==", tenantId);

  if (statuses.length === 1) {
    q = q.where("status", "==", statuses[0]);
  } else if (statuses.length > 1) {
    q = q.where("status", "in", statuses.slice(0, 10));
  }

  if (opts?.assignedTo) {
    q = q.where("assigned_to", "==", opts.assignedTo);
  }
  if (opts?.payment) {
    q = q.where("payment.payment_status", "==", opts.payment);
  }
  if (opts?.from) {
    q = q.where("createdAt", ">=", dateStartIso(opts.from));
  }
  if (opts?.to) {
    q = q.where("createdAt", "<=", dateEndIso(opts.to));
  }

  q = q.orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");

  const cursor = decodeOrderCursor(opts?.cursor);
  if (cursor) {
    q = q.startAfter(cursor.createdAt, cursor.id);
  }

  const snap = await q.limit(safeLimit + 1).get();
  const rows = snap.docs.map((d) => {
    const data = d.data() as Order;
    return omitWooSnapshotForList({ ...data, id: data.id || d.id });
  });
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
  const db = getDb();
  let q = db.collection(COLLECTIONS.orders).where("tenantId", "==", tenantId);
  if (statuses.length === 1) q = q.where("status", "==", statuses[0]);
  else if (statuses.length > 1) q = q.where("status", "in", statuses.slice(0, 10));
  if (opts?.payment) q = q.where("payment.payment_status", "==", opts.payment);
  if (opts?.assignedTo) q = q.where("assigned_to", "==", opts.assignedTo);
  if (opts?.from) q = q.where("createdAt", ">=", dateStartIso(opts.from));
  if (opts?.to) q = q.where("createdAt", "<=", dateEndIso(opts.to));
  const snap = await q.count().get();
  return snap.data().count;
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
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.orders)
    .where("tenantId", "==", tenantId)
    .orderBy("updatedAt", "desc")
    .limit(safeLimit)
    .get();
  return snap.docs.map((d) => omitWooSnapshotForList(d.data() as Order));
}

export async function getOrder(
  tenantId: string,
  orderId: string,
): Promise<Order | null> {
  if (isDevMockDataEnabled()) return mockGetOrder(tenantId, orderId);
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.orders).doc(orderId).get();
  const o = snap.data() as Order | undefined;
  if (!o || o.tenantId !== tenantId) return null;
  return o;
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

  const db = getDb();
  const base = db
    .collection(COLLECTIONS.orders)
    .where("tenantId", "==", tenantId)
    .where("status", "==", order.status)
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc");

  const curRef = db.collection(COLLECTIONS.orders).doc(id);
  const curSnap = await curRef.get();
  if (!curSnap.exists) return null;

  const [newerSnap, olderSnap] = await Promise.all([
    base.endBefore(curSnap).limit(1).get(),
    base.startAfter(curSnap).limit(1).get(),
  ]);

  return {
    prevId: newerSnap.empty ? null : newerSnap.docs[0]!.id,
    nextId: olderSnap.empty ? null : olderSnap.docs[0]!.id,
  };
}

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
}): Promise<Order> {
  if (isDevMockDataEnabled()) return mockUpsertOrderFromWooCommerce(input);
  const db = getDb();
  const existing = await db
    .collection(COLLECTIONS.orders)
    .where("tenantId", "==", input.tenantId)
    .where("wooCommerceOrderId", "==", input.wooOrderId)
    .limit(1)
    .get();

  const now = new Date().toISOString();
  if (!existing.empty) {
    const ref = existing.docs[0].ref;
    const prev = existing.docs[0].data() as Order;
    const paymentLocked = prev.status !== "pending_confirmation";
    const snap =
      input.woocommerceOrderSnapshot != null
        ? cloneJsonForFirestore(input.woocommerceOrderSnapshot)
        : prev.woocommerceOrderSnapshot;
    const next: Order = {
      ...prev,
      customer: input.customer,
      payment: paymentLocked ? prev.payment : input.payment,
      lineItems: input.lineItems ?? prev.lineItems,
      shipping: input.shipping ?? prev.shipping,
      notes: input.notes ?? prev.notes,
      woocommerceOrderSnapshot: snap,
      updatedAt: now,
    };
    await ref.set(omitUndefinedForFirestore(next));
    await logActivity({
      tenantId: input.tenantId,
      action: "order.upsert_webhook",
      entityType: "order",
      entityId: prev.id,
      userId: input.actorUserId,
    });
    return next;
  }

  const id = crypto.randomUUID();
  const order: Order = {
    id,
    tenantId: input.tenantId,
    customer: input.customer,
    payment: input.payment,
    status: "pending_confirmation",
    shipmentIds: [],
    wooCommerceOrderId: input.wooOrderId,
    lineItems: input.lineItems,
    shipping: input.shipping,
    notes: input.notes,
    woocommerceOrderSnapshot:
      input.woocommerceOrderSnapshot != null
        ? cloneJsonForFirestore(input.woocommerceOrderSnapshot)
        : undefined,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTIONS.orders).doc(id).set(omitUndefinedForFirestore(order));
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
  });
  await recordNewOrderAnalytics(order);
  return order;
}

async function transition(
  tenantId: string,
  orderId: string,
  to: OrderStatus,
  actorUserId: string,
  extra?: Partial<Order>,
  activityMetadata?: Record<string, unknown>,
) {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.orders).doc(orderId);
  const snap = await ref.get();
  const order = snap.data() as Order | undefined;
  if (!order || order.tenantId !== tenantId) throw new Error("Order not found");
  assertTransition(order.status, to);
  const now = new Date().toISOString();
  const prevStatus = order.status;
  const next: Order = { ...order, ...extra, status: to, updatedAt: now };
  await ref.set(next);

  await applyOrderStageRollupDelta({
    tenantId,
    from: prevStatus,
    to,
    orderValue: orderValueForStageRollup(order),
  });

  await logActivity({
    tenantId,
    action: `order.status.${to}`,
    entityType: "order",
    entityId: orderId,
    userId: actorUserId,
    metadata: { from: prevStatus, ...(activityMetadata ?? {}) },
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
    paymentExtra,
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
  const db = getDb();
  const ref = db.collection(COLLECTIONS.orders).doc(input.orderId);
  const snap = await ref.get();
  let current = snap.data() as Order | undefined;
  if (!current || current.tenantId !== input.tenantId) {
    throw new Error("Order not found");
  }

  const invoice = {
    number: input.invoiceNumber,
    issuedAt: new Date().toISOString(),
  };

  if (current.status === "confirmed") {
    assertTransition(current.status, "invoicing");
    const prevStatus = current.status;
    const now = new Date().toISOString();
    current = {
      ...current,
      status: "invoicing",
      invoice,
      updatedAt: now,
    };
    await ref.set(current);
    await applyOrderStageRollupDelta({
      tenantId: input.tenantId,
      from: "confirmed",
      to: "invoicing",
      orderValue: orderValueForStageRollup(current),
    });
    await logActivity({
      tenantId: input.tenantId,
      action: "order.status.invoicing",
      entityType: "order",
      entityId: input.orderId,
      userId: input.actorUserId,
      metadata: { from: prevStatus },
    });

    enqueueSyncOrderStatusToWooCommerce({
      tenantId: input.tenantId,
      order: current,
      actorUserId: input.actorUserId,
    });

    await dispatchOrderStatusWebhooks({
      tenantId: input.tenantId,
      order: current,
      fromStatus: prevStatus,
      toStatus: "invoicing",
      actorUserId: input.actorUserId,
    });

    const automation = await getTenantAutomation(input.tenantId);
    if (
      shouldAutoCreateShipment(prevStatus, "invoicing", automation) &&
      orderNeedsDeliveryShipment(current)
    ) {
      await createShipmentForOrder({
        tenantId: input.tenantId,
        orderId: input.orderId,
        type: "delivery",
        actorUserId: input.actorUserId,
      });
    }
  }

  if (current.status !== "invoicing") {
    throw new Error(`Cannot invoice from status ${current.status}`);
  }

  const { order: final } = await transition(
    input.tenantId,
    input.orderId,
    "ready_for_warehouse",
    input.actorUserId,
    { invoice },
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
      cancelReason: input.reason,
      cancelledAt: new Date().toISOString(),
      cancelledByUserId: input.actorUserId,
    },
    { reason: input.reason },
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

  const db = getDb();
  const orderRef = db.collection(COLLECTIONS.orders).doc(input.orderId);
  const orderSnap = await orderRef.get();
  const order = orderSnap.data() as Order | undefined;
  if (!order || order.tenantId !== input.tenantId) {
    throw new Error("Order not found");
  }

  const [shipmentSnap, ticketSnap] = await Promise.all([
    db
      .collection(COLLECTIONS.shipments)
      .where("tenantId", "==", input.tenantId)
      .where("order_id", "==", input.orderId)
      .get(),
    db
      .collection(COLLECTIONS.tickets)
      .where("tenantId", "==", input.tenantId)
      .where("order_id", "==", input.orderId)
      .get(),
  ]);

  const deletedShipmentIds = shipmentSnap.docs.map((doc) => doc.id);
  const deletedTicketIds = ticketSnap.docs.map((doc) => doc.id);
  const now = new Date().toISOString();
  const activityId = crypto.randomUUID();
  const batch = db.batch();

  for (const doc of shipmentSnap.docs) batch.delete(doc.ref);
  for (const doc of ticketSnap.docs) batch.delete(doc.ref);
  batch.delete(orderRef);
  batch.set(
    db.collection(COLLECTIONS.activityLogs).doc(activityId),
    omitUndefinedForFirestore({
      id: activityId,
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
      timestamp: now,
    }),
  );

  await batch.commit();
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
  const db = getDb();
  const ref = db.collection(COLLECTIONS.orders).doc(input.orderId);
  const snap = await ref.get();
  const order = snap.data() as Order | undefined;
  if (!order || order.tenantId !== input.tenantId) throw new Error("Order not found");
  const now = new Date().toISOString();
  const next: Order = {
    ...order,
    assigned_to: input.assigneeUserId,
    updatedAt: now,
  };
  await ref.set(next);
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
 */
export async function revertOrderStage(input: {
  tenantId: string;
  orderId: string;
  to: "invoicing" | "ready_for_warehouse";
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

  const db = getDb();
  const oref = db.collection(COLLECTIONS.orders).doc(input.orderId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(oref);
    const order = snap.data() as Order | undefined;
    if (!order || order.tenantId !== input.tenantId) {
      throw new Error("Order not found");
    }
    assertWarehouseRevert(order.status, input.to);
    const from = order.status;
    const now = new Date().toISOString();
    const next: Order = { ...order, status: input.to, updatedAt: now };
    tx.update(oref, { status: next.status, updatedAt: now });

    if (from === "packed" && input.to === "ready_for_warehouse") {
      for (const sid of order.shipmentIds ?? []) {
        const sref = db.collection(COLLECTIONS.shipments).doc(sid);
        const sSnap = await tx.get(sref);
        if (!sSnap.exists) continue;
        const sh = sSnap.data() as Shipment;
        if (sh.tenantId !== input.tenantId || sh.type !== "delivery")
          continue;
        tx.update(sref, {
          status: "created",
          packedAt: null,
          shippedAt: null,
          updatedAt: now,
        } as unknown as { status: string; packedAt: null; shippedAt: null; updatedAt: string });
        tx.update(oref, {
          latestShipmentAwb: sh.awb,
          latestShipmentCarrierTrackingStatus: sh.carrierTrackingStatus ?? null,
          latestShipmentStatus: "created",
          updatedAt: now,
        });
        break;
      }
    }
    return { from, next };
  });

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
