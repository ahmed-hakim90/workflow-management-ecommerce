import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockCreateShipmentForOrder,
  mockListShipmentsForOrder,
  mockListShipmentsForTenant,
  mockGetOrder,
  mockScanAwb,
} from "@/lib/dev/mock-backend";
import type { Order, Shipment, ShipmentStatus, ShipmentType } from "@/lib/types/models";
import { assertWarehouseScanTransition } from "@/lib/logic/order-state-machine-warehouse";
import { createBostaShipment } from "@/lib/integrations/bosta";
import { logActivity } from "@/lib/services/activity.service";
import {
  applyOrderStageRollupDelta,
  orderValueForStageRollup,
} from "@/lib/services/order-stage-rollup.service";
import { incrementUserStat } from "@/lib/services/user-stats.service";
import { recordDeliveryShipmentAnalytics } from "@/lib/services/analytics-daily.service";
import { getUser } from "@/lib/services/users.service";
import { enqueueSyncOrderStatusToWooCommerce } from "@/lib/services/woocommerce-sync.service";
import { getWarehouseSettings } from "@/lib/services/tenant-settings.service";
import { dispatchOrderStatusWebhooks } from "@/lib/services/outbound-webhooks.service";

async function getOrder(tenantId: string, orderId: string): Promise<Order | null> {
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.orders).doc(orderId).get();
  const o = snap.data() as Order | undefined;
  if (!o || o.tenantId !== tenantId) return null;
  return o;
}

export async function listShipmentsForOrder(
  tenantId: string,
  orderId: string,
): Promise<Shipment[]> {
  if (isDevMockDataEnabled()) return mockListShipmentsForOrder(tenantId, orderId);
  const db = getDb();
  const q = await db
    .collection(COLLECTIONS.shipments)
    .where("tenantId", "==", tenantId)
    .where("order_id", "==", orderId)
    .get();
  return q.docs.map((d) => d.data() as Shipment);
}

export async function listShipmentsForTenant(
  tenantId: string,
): Promise<Shipment[]> {
  if (isDevMockDataEnabled()) return mockListShipmentsForTenant(tenantId);
  const db = getDb();
  const q = await db
    .collection(COLLECTIONS.shipments)
    .where("tenantId", "==", tenantId)
    .get();
  return q.docs.map((d) => d.data() as Shipment);
}

export async function createShipmentForOrder(input: {
  tenantId: string;
  orderId: string;
  type?: ShipmentType;
  actorUserId: string;
}): Promise<Shipment> {
  if (isDevMockDataEnabled()) return mockCreateShipmentForOrder(input);
  const order = await getOrder(input.tenantId, input.orderId);
  if (!order) throw new Error("Order not found");

  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const type: ShipmentType = input.type ?? "delivery";

  const bosta = await createBostaShipment({
    tenantId: input.tenantId,
    order,
    type,
    shipmentId: id,
  });

  const shipping_fees = bosta.shippingFee ?? order.shipping?.cost ?? 0;

  const actor = await getUser(input.tenantId, input.actorUserId);
  const createdByUserName = actor?.name ?? input.actorUserId;

  const shipment: Shipment = {
    id,
    tenantId: input.tenantId,
    order_id: input.orderId,
    awb: bosta.awb,
    type,
    status: "created",
    provider: bosta.provider,
    externalId: bosta.externalId,
    shipping_fees,
    createdByUserId: input.actorUserId,
    createdByUserName,
    createdAt: now,
    updatedAt: now,
  };

  await db.runTransaction(async (tx) => {
    const oref = db.collection(COLLECTIONS.orders).doc(input.orderId);
    const osnap = await tx.get(oref);
    const current = osnap.data() as Order;
    const shipmentIds = [...(current.shipmentIds ?? []), id];
    tx.update(oref, { shipmentIds, updatedAt: now });
    tx.set(db.collection(COLLECTIONS.shipments).doc(id), shipment);
  });

  await logActivity({
    tenantId: input.tenantId,
    action: "shipment.created",
    entityType: "shipment",
    entityId: id,
    userId: input.actorUserId,
    metadata: { orderId: input.orderId, awb: shipment.awb },
  });

  await recordDeliveryShipmentAnalytics({
    tenantId: input.tenantId,
    shipmentCreatedAt: now,
    type,
    shippingCost: shipping_fees,
  });

  return shipment;
}

function err400(msg: string) {
  const e = new Error(msg) as Error & { status: number };
  e.status = 400;
  return e;
}

/**
 * Warehouse scan: per-tenant can be one step (packed then shipped) or
 * one scan to shipped from ready_for_warehouse. Cooldown between packed and shipped
 * in per_step mode to avoid double taps.
 */
export async function scanAwb(input: {
  tenantId: string;
  awb: string;
  actorUserId: string;
}): Promise<{ order: Order; shipment: Shipment }> {
  if (isDevMockDataEnabled()) {
    const shipments = mockListShipmentsForTenant(input.tenantId);
    const match = shipments.find((s) => s.awb === input.awb);
    const prevOrder = match ? mockGetOrder(input.tenantId, match.order_id) : null;
    const result = await mockScanAwb(input);
    if (prevOrder) {
      await dispatchOrderStatusWebhooks({
        tenantId: input.tenantId,
        order: result.order,
        fromStatus: prevOrder.status,
        toStatus: result.order.status,
        actorUserId: input.actorUserId,
      });
    }
    return result;
  }
  const wh = await getWarehouseSettings(input.tenantId);
  const mode = wh.singleScanFulfills ? "single_fulfill" : "per_step";
  const cooldownMs = wh.scanCooldownMs;
  const db = getDb();
  const q = await db
    .collection(COLLECTIONS.shipments)
    .where("tenantId", "==", input.tenantId)
    .where("awb", "==", input.awb)
    .limit(1)
    .get();
  if (q.empty) throw new Error("Shipment not found for AWB");

  const shipRef = q.docs[0].ref;

  const result = await db.runTransaction(async (tx) => {
    const shipSnap = await tx.get(shipRef);
    const shipment = shipSnap.data() as Shipment;
    const oref = db.collection(COLLECTIONS.orders).doc(shipment.order_id);
    const orderSnap = await tx.get(oref);
    const order = orderSnap.data() as Order;
    if (order.tenantId !== input.tenantId) throw new Error("Tenant mismatch");

    const now = new Date().toISOString();
    let newOrderStatus = order.status;
    let newShipmentStatus: ShipmentStatus = shipment.status;
    let packedAt = shipment.packedAt;
    let shippedAt = shipment.shippedAt;

    if (order.status === "shipped" && shipment.status === "shipped") {
      throw new Error("Duplicate scan: order already shipped for this AWB");
    }

    if (order.status === "ready_for_warehouse") {
      if (mode === "single_fulfill") {
        assertWarehouseScanTransition("ready_for_warehouse", "shipped", "single_fulfill");
        newOrderStatus = "shipped";
        newShipmentStatus = "shipped";
        packedAt = now;
        shippedAt = now;
      } else {
        assertWarehouseScanTransition("ready_for_warehouse", "packed", "per_step");
        newOrderStatus = "packed";
        newShipmentStatus = "packed";
        packedAt = now;
      }
    } else if (order.status === "packed") {
      if (cooldownMs > 0 && shipment.packedAt) {
        const elapsed = Date.now() - new Date(shipment.packedAt).getTime();
        if (elapsed < cooldownMs) {
          throw err400(
            `الانتظار ${Math.ceil((cooldownMs - elapsed) / 1000)} ث قبل تأكيد الشحن.`,
          );
        }
      }
      assertWarehouseScanTransition("packed", "shipped", mode);
      newOrderStatus = "shipped";
      newShipmentStatus = "shipped";
      shippedAt = now;
    } else {
      throw new Error(
        `Scan not allowed for order status ${order.status} (expected ready_for_warehouse or packed)`,
      );
    }

    tx.update(oref, { status: newOrderStatus, updatedAt: now });
    tx.update(shipRef, {
      status: newShipmentStatus,
      packedAt: packedAt ?? null,
      shippedAt: shippedAt ?? null,
      updatedAt: now,
    });

    return {
      prevOrderStatus: order.status,
      order: { ...order, status: newOrderStatus, updatedAt: now },
      shipment: {
        ...shipment,
        status: newShipmentStatus,
        packedAt,
        shippedAt,
        updatedAt: now,
      },
    };
  });

  await applyOrderStageRollupDelta({
    tenantId: input.tenantId,
    from: result.prevOrderStatus,
    to: result.order.status,
    orderValue: orderValueForStageRollup(result.order),
  });

  await logActivity({
    tenantId: input.tenantId,
    action: "shipment.scan",
    entityType: "shipment",
    entityId: result.shipment.id,
    userId: input.actorUserId,
    metadata: { awb: input.awb, orderStatus: result.order.status, scanMode: mode },
  });

  const shouldIncPacked =
    result.order.status === "packed" ||
    (wh.singleScanFulfills &&
      result.prevOrderStatus === "ready_for_warehouse" &&
      result.order.status === "shipped");
  if (shouldIncPacked) {
    await incrementUserStat({
      tenantId: input.tenantId,
      userId: input.actorUserId,
      field: "packed",
    });
  }

  enqueueSyncOrderStatusToWooCommerce({
    tenantId: input.tenantId,
    order: result.order,
    actorUserId: input.actorUserId,
  });

  await dispatchOrderStatusWebhooks({
    tenantId: input.tenantId,
    order: result.order,
    fromStatus: result.prevOrderStatus,
    toStatus: result.order.status,
    actorUserId: input.actorUserId,
  });

  return result;
}
