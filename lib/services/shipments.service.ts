import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockCreateShipmentForOrder,
  mockListShipmentsForOrder,
  mockScanAwb,
} from "@/lib/dev/mock-backend";
import type { Order, Shipment, ShipmentStatus, ShipmentType } from "@/lib/types/models";
import { assertTransition } from "@/lib/logic/order-state-machine";
import { createBostaShipment } from "@/lib/integrations/bosta";
import { logActivity } from "@/lib/services/activity.service";
import { incrementUserStat } from "@/lib/services/user-stats.service";
import { getUser } from "@/lib/services/users.service";

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
    order,
    type,
    shipmentId: id,
  });

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

  return shipment;
}

/**
 * Warehouse scan: first scan packs order; second scan ships.
 */
export async function scanAwb(input: {
  tenantId: string;
  awb: string;
  actorUserId: string;
}): Promise<{ order: Order; shipment: Shipment }> {
  if (isDevMockDataEnabled()) return mockScanAwb(input);
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

    if (order.status === "ready_for_warehouse") {
      assertTransition(order.status, "packed");
      newOrderStatus = "packed";
      newShipmentStatus = "packed";
      packedAt = now;
    } else if (order.status === "packed") {
      assertTransition(order.status, "shipped");
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

  await logActivity({
    tenantId: input.tenantId,
    action: "shipment.scan",
    entityType: "shipment",
    entityId: result.shipment.id,
    userId: input.actorUserId,
    metadata: { awb: input.awb, orderStatus: result.order.status },
  });

  if (result.order.status === "packed") {
    await incrementUserStat({
      tenantId: input.tenantId,
      userId: input.actorUserId,
      field: "packed",
    });
  }

  return result;
}
