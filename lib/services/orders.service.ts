import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import type { Order, OrderStatus, Shipment } from "@/lib/types/models";
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

export async function listOrders(
  tenantId: string,
  opts?: { status?: OrderStatus; assignedTo?: string; from?: string; to?: string },
): Promise<Order[]> {
  if (isDevMockDataEnabled()) return mockListOrders(tenantId, opts);
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.orders)
    .where("tenantId", "==", tenantId)
    .orderBy("updatedAt", "desc")
    .limit(500)
    .get();
  let rows = snap.docs.map((d) => d.data() as Order);
  if (opts?.status) {
    rows = rows.filter((o) => o.status === opts.status);
  }
  if (opts?.assignedTo) {
    rows = rows.filter((o) => o.assigned_to === opts.assignedTo);
  }
  if (opts?.from) {
    const fromTime = new Date(`${opts.from}T00:00:00.000Z`).getTime();
    rows = rows.filter((o) => new Date(o.createdAt).getTime() >= fromTime);
  }
  if (opts?.to) {
    const toTime = new Date(`${opts.to}T23:59:59.999Z`).getTime();
    rows = rows.filter((o) => new Date(o.createdAt).getTime() <= toTime);
  }
  return rows.slice(0, 200).map(omitWooSnapshotForList);
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
