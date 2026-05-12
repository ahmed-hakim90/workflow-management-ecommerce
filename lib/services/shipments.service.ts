import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockCreateShipmentForOrder,
  mockListShipmentsForOrder,
  mockListShipmentsForTenant,
  mockGetOrder,
  mockScanAwb,
  mockSyncShipmentTracking,
  mockCancelShipment,
  mockUpdateShipment,
} from "@/lib/dev/mock-backend";
import type {
  Order,
  Shipment,
  ShipmentLabelFormat,
  ShipmentStatus,
  ShipmentType,
  ShippingProvider,
} from "@/lib/types/models";
import { assertWarehouseScanTransition } from "@/lib/logic/order-state-machine-warehouse";
import { getShippingCarrierAdapter } from "@/lib/integrations/shipping/registry";
import { logActivity } from "@/lib/services/activity.service";
import {
  applyOrderStageRollupDelta,
  orderValueForStageRollup,
} from "@/lib/services/order-stage-rollup.service";
import { incrementUserStat } from "@/lib/services/user-stats.service";
import {
  recordDeliveryShipmentAnalytics,
  recordShipmentShippingCostAdjustment,
} from "@/lib/services/analytics-daily.service";
import { getUser } from "@/lib/services/users.service";
import { enqueueSyncOrderStatusToWooCommerce } from "@/lib/services/woocommerce-sync.service";
import { getWarehouseSettings } from "@/lib/services/tenant-settings.service";
import { dispatchOrderStatusWebhooks } from "@/lib/services/outbound-webhooks.service";
import { emitOmsEventDeferred } from "@/lib/services/events/oms-event-emitter.service";
import { getTenantAutomation } from "@/lib/services/tenant-settings.service";
import { findConversationByCustomerPhone } from "@/lib/services/chat/conversations.service";
import { normalizeCustomerPhone } from "@/lib/logic/phone-normalize";
import { getFullOrderDoc, updateOrderDoc } from "@/lib/repositories/orders.repository";

function latestShipmentOrderFields(shipment: Shipment) {
  return {
    latestShipmentAwb: shipment.awb,
    latestShipmentCarrierTrackingStatus: shipment.carrierTrackingStatus,
    latestShipmentStatus: shipment.status,
  };
}

type ShipmentRow = {
  id: string;
  tenant_id: string;
  order_id: string;
  awb: string;
  type: ShipmentType;
  status: ShipmentStatus;
  provider: ShippingProvider;
  external_id?: string | null;
  carrier_tracking_status?: string | null;
  tracking_history?: Shipment["trackingHistory"] | null;
  payload?: Partial<Shipment> | null;
  created_at: string;
  updated_at: string;
};

function rowToShipment(row: ShipmentRow): Shipment {
  return {
    ...(row.payload ?? {}),
    id: row.id,
    tenantId: row.tenant_id,
    order_id: row.order_id,
    awb: row.awb,
    type: row.type,
    status: row.status,
    provider: row.provider,
    externalId: row.external_id ?? row.payload?.externalId,
    carrierTrackingStatus:
      row.carrier_tracking_status ?? row.payload?.carrierTrackingStatus,
    trackingHistory: row.tracking_history ?? row.payload?.trackingHistory,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as Shipment;
}

function shipmentToRow(shipment: Shipment) {
  return {
    id: shipment.id,
    tenant_id: shipment.tenantId,
    order_id: shipment.order_id,
    awb: shipment.awb,
    type: shipment.type,
    status: shipment.status,
    provider: shipment.provider,
    external_id: shipment.externalId,
    carrier_tracking_status: shipment.carrierTrackingStatus,
    tracking_history: shipment.trackingHistory ?? [],
    payload: shipment,
    created_at: shipment.createdAt,
    updated_at: shipment.updatedAt,
  };
}

async function getShipment(tenantId: string, shipmentId: string) {
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("shipments")
    .select("*")
    .eq("id", shipmentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToShipment(data as ShipmentRow) : null;
}

async function setShipment(shipment: Shipment) {
  const { error } = await getSupabaseServiceRoleClient()
    .from("shipments")
    .upsert(shipmentToRow(shipment));
  if (error) throw error;
}

function paymentWithCod(order: Order, codAmount: number) {
  const total = Math.round(order.payment.total_amount * 100) / 100;
  const cod = Math.round(Math.max(0, codAmount) * 100) / 100;
  const paid = Math.round(Math.max(0, total - cod) * 100) / 100;
  return {
    payment_status:
      cod <= 0 ? ("paid" as const) : cod >= total ? ("cod" as const) : ("partial" as const),
    total_amount: total,
    paid_amount: paid,
    remaining_amount: cod,
    cod_amount: cod,
  };
}

async function getOrder(tenantId: string, orderId: string): Promise<Order | null> {
  return getFullOrderDoc(tenantId, orderId);
}

export async function listShipmentsForOrder(
  tenantId: string,
  orderId: string,
): Promise<Shipment[]> {
  if (isDevMockDataEnabled()) return mockListShipmentsForOrder(tenantId, orderId);
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("shipments")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("order_id", orderId);
  if (error) throw error;
  return (data ?? []).map((row) => rowToShipment(row as ShipmentRow));
}

export async function listShipmentsForTenant(
  tenantId: string,
  opts?: { from?: string; to?: string },
): Promise<Shipment[]> {
  if (isDevMockDataEnabled()) return mockListShipmentsForTenant(tenantId, opts);
  let q = getSupabaseServiceRoleClient()
    .from("shipments")
    .select("*")
    .eq("tenant_id", tenantId);
  if (opts?.from) q = q.gte("created_at", `${opts.from}T00:00:00.000Z`);
  if (opts?.to) q = q.lte("created_at", `${opts.to}T23:59:59.999Z`);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  let rows = (data ?? []).map((row) => rowToShipment(row as ShipmentRow));
  if (opts?.from) {
    const fromTime = new Date(`${opts.from}T00:00:00.000Z`).getTime();
    rows = rows.filter((s) => new Date(s.createdAt).getTime() >= fromTime);
  }
  if (opts?.to) {
    const toTime = new Date(`${opts.to}T23:59:59.999Z`).getTime();
    rows = rows.filter((s) => new Date(s.createdAt).getTime() <= toTime);
  }
  return rows;
}

export async function countShipmentsForTenant(tenantId: string): Promise<number> {
  if (isDevMockDataEnabled()) return mockListShipmentsForTenant(tenantId).length;
  const { count, error } = await getSupabaseServiceRoleClient()
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return count ?? 0;
}

export async function createShipmentForOrder(input: {
  tenantId: string;
  orderId: string;
  type?: ShipmentType;
  provider?: ShippingProvider;
  serviceCode?: string;
  labelFormat?: ShipmentLabelFormat;
  actorUserId: string;
}): Promise<Shipment> {
  if (isDevMockDataEnabled()) return mockCreateShipmentForOrder(input);
  const order = await getOrder(input.tenantId, input.orderId);
  if (!order) throw new Error("Order not found");

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const type: ShipmentType = input.type ?? "delivery";
  const provider: ShippingProvider = input.provider ?? "bosta";
  const actor = await getUser(input.tenantId, input.actorUserId);
  const createdByUserName = actor?.name ?? input.actorUserId;
  const adapter = getShippingCarrierAdapter(provider);
  if (!adapter) {
    const err = new Error("شركة الشحن غير مدعومة لإنشاء بوليصة فعلية.");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  const carrier = await adapter.createShipment({
    tenantId: input.tenantId,
    order,
    type,
    shipmentId: id,
    actorUserId: input.actorUserId,
    actorUserName: createdByUserName,
    serviceCode: input.serviceCode,
    labelFormat: input.labelFormat,
  });

  const shipping_fees =
    carrier.provider !== "mock"
      ? carrier.shippingFee
      : carrier.shippingFee ?? order.shipping?.cost ?? 0;

  const shipment: Shipment = {
    id,
    tenantId: input.tenantId,
    order_id: input.orderId,
    awb: carrier.awb,
    type,
    status: "created",
    provider: carrier.provider,
    externalId: carrier.externalId,
    serviceCode: carrier.serviceCode ?? input.serviceCode,
    labelFormat: carrier.labelFormat ?? input.labelFormat,
    labelUrl: carrier.labelUrl,
    labelData: carrier.labelData,
    thermalLabelUrl: carrier.thermalLabelUrl,
    thermalLabelData: carrier.thermalLabelData,
    carrierAccountRef: carrier.carrierAccountRef,
    rawCarrierStatus: carrier.rawCarrierStatus,
    cod_amount: order.payment.cod_amount,
    allow_opening: false,
    shipping_fees,
    createdByUserId: input.actorUserId,
    createdByUserName,
    carrierTrackingStatus: carrier.carrierTrackingStatus ?? "created",
    trackingHistory: [{ at: now, status: "created" }],
    createdAt: now,
    updatedAt: now,
  };

  const current = await getOrder(input.tenantId, input.orderId);
  if (!current) throw new Error("Order not found");
  await setShipment(shipment);
  await updateOrderDoc(input.orderId, {
    shipmentIds: [...(current.shipmentIds ?? []), id],
    ...latestShipmentOrderFields(shipment),
    updatedAt: now,
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
    shippingCost: shipping_fees ?? 0,
  });

  const automation = await getTenantAutomation(input.tenantId);
  if (automation.whatsappAutomationEnabled) {
    const phone = normalizeCustomerPhone(order.customer.phone);
    const linkedConv =
      phone != null
        ? await findConversationByCustomerPhone(input.tenantId, phone)
        : null;
    emitOmsEventDeferred({
      source: "api",
      event: "shipment.created",
      tenantId: input.tenantId,
      orderId: input.orderId,
      conversationId: linkedConv?.id,
      metadata: {
        shipmentId: id,
        awb: shipment.awb,
        type,
      },
    });
  }

  return shipment;
}

export async function updateShipment(input: {
  tenantId: string;
  shipmentId: string;
  actorUserId: string;
  codAmount?: number;
  allowOpening?: boolean;
  notes?: string;
}): Promise<Shipment> {
  if (isDevMockDataEnabled()) return mockUpdateShipment(input);
  const shipment = await getShipment(input.tenantId, input.shipmentId);
  if (!shipment) {
    throw new Error("Shipment not found");
  }
  if (shipment.status === "cancelled") {
    const err = new Error("لا يمكن تعديل بوليصة ملغاة.");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  if (shipment.status === "shipped" || shipment.status === "delivered") {
    const err = new Error(
      "لا يمكن تعديل هذه البوليصة بعد تسليمها للمندوب. ألغِ البوليصة وأنشئ واحدة جديدة إذا كان ذلك متاحاً.",
    );
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  if (
    input.codAmount === undefined &&
    input.allowOpening === undefined &&
    !input.notes?.trim()
  ) {
    const err = new Error("لا توجد تعديلات للحفظ.");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  const order = await getOrder(input.tenantId, shipment.order_id);
  if (!order) throw new Error("Order not found");
  if (
    input.codAmount !== undefined &&
    (input.codAmount < 0 || input.codAmount > order.payment.total_amount)
  ) {
    const err = new Error("مبلغ التحصيل يجب أن يكون بين صفر وإجمالي الطلب.");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  const adapter = getShippingCarrierAdapter(shipment.provider);
  if (!adapter?.updateShipment) {
    const err = new Error("شركة الشحن لا تدعم تعديل البوليصة من النظام.");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  const tracking = await adapter.updateShipment({
    tenantId: input.tenantId,
    awb: shipment.awb,
    externalId: shipment.externalId,
    serviceCode: shipment.serviceCode,
    changes: {
      codAmount: input.codAmount,
      allowOpening: input.allowOpening,
      notes: input.notes,
    },
  });
  const now = new Date().toISOString();
  const event = {
    at: now,
    status: tracking.status,
    details:
      tracking.details ??
      [
        input.codAmount !== undefined ? `COD ${input.codAmount}` : undefined,
        input.allowOpening !== undefined
          ? `allow_opening ${input.allowOpening ? "yes" : "no"}`
          : undefined,
      ]
        .filter(Boolean)
        .join(" | "),
  };
  const next: Shipment = {
    ...shipment,
    cod_amount: input.codAmount ?? shipment.cod_amount,
    allow_opening: input.allowOpening ?? shipment.allow_opening,
    carrierTrackingStatus: tracking.status || shipment.carrierTrackingStatus,
    lastTrackingSyncAt: now,
    trackingHistory: [...(shipment.trackingHistory ?? []), event].slice(-25),
    updatedAt: now,
  };
  const orderPatch =
    input.codAmount !== undefined && shipment.type === "delivery"
      ? { payment: paymentWithCod(order, input.codAmount) }
      : {};

  await setShipment(next);
  await updateOrderDoc(shipment.order_id, {
    ...orderPatch,
    ...latestShipmentOrderFields(next),
    updatedAt: now,
  });
  await logActivity({
    tenantId: input.tenantId,
    action: "shipment.updated",
    entityType: "shipment",
    entityId: input.shipmentId,
    userId: input.actorUserId,
    metadata: {
      awb: shipment.awb,
      codAmount: input.codAmount,
      allowOpening: input.allowOpening,
      notes: input.notes?.trim() || undefined,
    },
  });
  return next;
}

export async function syncShipmentTracking(input: {
  tenantId: string;
  shipmentId: string;
  actorUserId: string;
}): Promise<Shipment> {
  if (isDevMockDataEnabled()) return mockSyncShipmentTracking(input);
  const shipment = await getShipment(input.tenantId, input.shipmentId);
  if (!shipment) {
    throw new Error("Shipment not found");
  }
  const adapter = getShippingCarrierAdapter(shipment.provider);
  if (!adapter) {
    const err = new Error("شركة الشحن غير مدعومة لتحديث التتبع.");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  const tracking = await adapter.trackShipment({
    tenantId: input.tenantId,
    awb: shipment.awb,
    externalId: shipment.externalId,
    serviceCode: shipment.serviceCode,
  });
  const now = new Date().toISOString();
  const event = {
    at: now,
    status: tracking.status,
    ...(tracking.details ? { details: tracking.details } : {}),
  };
  const next: Shipment = {
    ...shipment,
    carrierTrackingStatus: tracking.status,
    shipping_fees:
      tracking.shippingFee !== undefined &&
      ((shipment.shipping_fees ?? 0) <= 0)
        ? tracking.shippingFee
        : shipment.shipping_fees,
    lastTrackingSyncAt: now,
    trackingHistory: [...(shipment.trackingHistory ?? []), event].slice(-25),
    updatedAt: now,
  };
  await setShipment(next);
  if ((next.shipping_fees ?? 0) !== (shipment.shipping_fees ?? 0)) {
    await recordShipmentShippingCostAdjustment({
      tenantId: input.tenantId,
      shipmentCreatedAt: shipment.createdAt,
      type: shipment.type,
      previousCost: shipment.shipping_fees ?? 0,
      nextCost: next.shipping_fees ?? 0,
    });
  }
  await updateOrderDoc(shipment.order_id, {
    ...latestShipmentOrderFields(next),
    updatedAt: now,
  });
  await logActivity({
    tenantId: input.tenantId,
    action: "shipment.tracking_synced",
    entityType: "shipment",
    entityId: input.shipmentId,
    userId: input.actorUserId,
    metadata: { awb: shipment.awb, carrierTrackingStatus: tracking.status },
  });
  return next;
}

export async function cancelShipment(input: {
  tenantId: string;
  shipmentId: string;
  actorUserId: string;
}): Promise<Shipment> {
  if (isDevMockDataEnabled()) return mockCancelShipment(input);
  const shipment = await getShipment(input.tenantId, input.shipmentId);
  if (!shipment) {
    throw new Error("Shipment not found");
  }
  if (shipment.status === "cancelled") return shipment;
  const adapter = getShippingCarrierAdapter(shipment.provider);
  if (!adapter) {
    const err = new Error("شركة الشحن غير مدعومة لإلغاء البوليصة.");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  const tracking = await adapter.cancelShipment({
    tenantId: input.tenantId,
    awb: shipment.awb,
    externalId: shipment.externalId,
    serviceCode: shipment.serviceCode,
  });
  const now = new Date().toISOString();
  const event = {
    at: now,
    status: tracking.status,
    ...(tracking.details ? { details: tracking.details } : {}),
  };
  const next: Shipment = {
    ...shipment,
    status: "cancelled",
    carrierTrackingStatus: tracking.status,
    lastTrackingSyncAt: now,
    cancelledAt: now,
    cancelledByUserId: input.actorUserId,
    trackingHistory: [...(shipment.trackingHistory ?? []), event].slice(-25),
    updatedAt: now,
  };
  await setShipment(next);
  await updateOrderDoc(shipment.order_id, {
    ...latestShipmentOrderFields(next),
    updatedAt: now,
  });
  await logActivity({
    tenantId: input.tenantId,
    action: "shipment.cancelled",
    entityType: "shipment",
    entityId: input.shipmentId,
    userId: input.actorUserId,
    metadata: { awb: shipment.awb, carrierTrackingStatus: tracking.status },
  });
  return next;
}

export async function getShipmentLabel(input: {
  tenantId: string;
  shipmentId: string;
  format?: ShipmentLabelFormat;
}): Promise<{
  format: ShipmentLabelFormat;
  contentType: string;
  data?: string;
  url?: string;
}> {
  if (isDevMockDataEnabled()) {
    const shipment = mockListShipmentsForTenant(input.tenantId).find(
      (s) => s.id === input.shipmentId,
    );
    if (!shipment) {
      const err = new Error("Shipment not found");
      (err as Error & { status?: number }).status = 404;
      throw err;
    }
    return {
      format: input.format ?? shipment.labelFormat ?? "pdf",
      contentType:
        input.format === "zpl" || input.format === "thermal"
          ? "text/plain"
          : "application/pdf",
      data:
        input.format === "zpl" || input.format === "thermal"
          ? shipment.thermalLabelData ?? "^XA^FO40,40^FDDEMO LABEL^FS^XZ"
          : shipment.labelData,
      url: input.format === "zpl" || input.format === "thermal"
        ? shipment.thermalLabelUrl
        : shipment.labelUrl,
    };
  }
  const shipment = await getShipment(input.tenantId, input.shipmentId);
  if (!shipment) {
    const err = new Error("Shipment not found");
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  const requested = input.format ?? shipment.labelFormat ?? "pdf";
  const isThermal = requested === "zpl" || requested === "thermal";
  const storedData = isThermal ? shipment.thermalLabelData : shipment.labelData;
  const storedUrl = isThermal ? shipment.thermalLabelUrl : shipment.labelUrl;
  if (storedData || storedUrl) {
    return {
      format: requested,
      contentType: isThermal ? "text/plain" : "application/pdf",
      data: storedData,
      url: storedUrl,
    };
  }
  const adapter = getShippingCarrierAdapter(shipment.provider);
  if (!adapter?.getLabel) {
    const err = new Error("لا توجد بوليصة محفوظة، وشركة الشحن لا تدعم إعادة طلب الطباعة.");
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  const label = await adapter.getLabel({
    tenantId: input.tenantId,
    awb: shipment.awb,
    externalId: shipment.externalId,
    serviceCode: shipment.serviceCode,
    format: requested,
  });
  if (!label?.data && !label?.url) {
    const err = new Error("شركة الشحن لم ترجع رابط أو محتوى للطباعة.");
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  const patch = isThermal
    ? {
        thermalLabelData: label.data,
        thermalLabelUrl: label.url,
        updatedAt: new Date().toISOString(),
      }
    : {
        labelData: label.data,
        labelUrl: label.url,
        labelFormat: label.format,
        updatedAt: new Date().toISOString(),
      };
  await setShipment({ ...shipment, ...patch } as Shipment);
  return label;
}

function err400(msg: string) {
  const e = new Error(msg) as Error & { status: number };
  e.status = 400;
  return e;
}

/**
 * Warehouse scan: per-tenant can be one step (`awb_created` → `out_for_shipping`)
 * or two-step (`awb_created` → `warehouse_packed` → `out_for_shipping`).
 * Cooldown between packed and shipped in per_step mode to avoid double taps.
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
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("shipments")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("awb", input.awb)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Shipment not found for AWB");
  const shipment = rowToShipment(data as ShipmentRow);
  const order = await getOrder(input.tenantId, shipment.order_id);
  if (!order) throw new Error("Tenant mismatch");

    const now = new Date().toISOString();
    let newOrderStatus = order.status;
    let newShipmentStatus: ShipmentStatus = shipment.status;
    let packedAt = shipment.packedAt;
    let shippedAt = shipment.shippedAt;

    if (order.status === "out_for_shipping" && shipment.status === "shipped") {
      throw new Error("Duplicate scan: order already shipped for this AWB");
    }

    if (order.status === "awb_created") {
      if (mode === "single_fulfill") {
        assertWarehouseScanTransition(
          "awb_created",
          "out_for_shipping",
          "single_fulfill",
        );
        newOrderStatus = "out_for_shipping";
        newShipmentStatus = "shipped";
        packedAt = now;
        shippedAt = now;
      } else {
        assertWarehouseScanTransition("awb_created", "warehouse_packed", "per_step");
        newOrderStatus = "warehouse_packed";
        newShipmentStatus = "packed";
        packedAt = now;
      }
    } else if (order.status === "warehouse_packed") {
      if (cooldownMs > 0 && shipment.packedAt) {
        const elapsed = Date.now() - new Date(shipment.packedAt).getTime();
        if (elapsed < cooldownMs) {
          throw err400(
            `الانتظار ${Math.ceil((cooldownMs - elapsed) / 1000)} ث قبل تأكيد الشحن.`,
          );
        }
      }
      assertWarehouseScanTransition("warehouse_packed", "out_for_shipping", mode);
      newOrderStatus = "out_for_shipping";
      newShipmentStatus = "shipped";
      shippedAt = now;
    } else {
      throw new Error(
        `Scan not allowed for order status ${order.status} (expected awb_created or warehouse_packed)`,
      );
    }

    const nextShipment = {
      ...shipment,
      status: newShipmentStatus,
      packedAt,
      shippedAt,
      updatedAt: now,
    };

    await updateOrderDoc(shipment.order_id, {
      status: newOrderStatus,
      ...latestShipmentOrderFields(nextShipment),
      updatedAt: now,
    });
    await setShipment(nextShipment);

  const result = {
    prevOrderStatus: order.status,
    order: { ...order, status: newOrderStatus, updatedAt: now },
    shipment: nextShipment,
  };

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
    result.order.status === "warehouse_packed" ||
    (wh.singleScanFulfills &&
      result.prevOrderStatus === "awb_created" &&
      result.order.status === "out_for_shipping");
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
