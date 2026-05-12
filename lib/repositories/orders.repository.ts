import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import type {
  Order,
  OrderStatus,
  Payment,
  PaymentStatus,
  ShipmentStatus,
} from "@/lib/types/models";
import type { OrderCursor } from "@/lib/db/order-pagination";

export const ORDER_LIST_SELECT_FIELDS = ["*"] as const;

export type OrderListQueryOpts = {
  statuses: OrderStatus[];
  payment?: PaymentStatus;
  shipping?: ShipmentStatus;
  assignedTo?: string;
  from?: string;
  to?: string;
};

type OrderRow = Record<string, unknown> & {
  id: string;
  tenant_id: string;
  customer: Order["customer"];
  payment: Payment;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
};

function dateStartIso(date: string) {
  return `${date}T00:00:00.000Z`;
}

function dateEndIso(date: string) {
  return `${date}T23:59:59.999Z`;
}

function camelPatchToSnake(patch: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, string> = {
    tenantId: "tenant_id",
    statusUpdatedAt: "status_updated_at",
    shipmentIds: "shipment_ids",
    cancelReason: "cancel_reason",
    cancelledAt: "cancelled_at",
    cancelledByUserId: "cancelled_by_user_id",
    externalOrderId: "external_order_id",
    lastSyncedAt: "last_synced_at",
    lineItemCount: "line_item_count",
    webhookPayloadRef: "webhook_payload_ref",
    lastWebhookSyncFingerprint: "last_webhook_sync_fingerprint",
    wooCommerceOrderId: "woocommerce_order_id",
    latestShipmentAwb: "latest_shipment_awb",
    latestShipmentCarrierTrackingStatus: "latest_shipment_carrier_tracking_status",
    latestShipmentStatus: "latest_shipment_status",
    whatsappSentAt: "whatsapp_sent_at",
    whatsappSentByUserId: "whatsapp_sent_by_user_id",
    whatsappSentByUserName: "whatsapp_sent_by_user_name",
    whatsappSentPhone: "whatsapp_sent_phone",
    woocommerceOrderSnapshot: "woocommerce_order_snapshot",
    createdAt: "created_at",
    updatedAt: "updated_at",
  };
  return Object.fromEntries(
    Object.entries(patch)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [map[key] ?? key, value]),
  );
}

export function orderToRow(order: Order): Record<string, unknown> {
  return camelPatchToSnake({
    id: order.id,
    tenantId: order.tenantId,
    customer: order.customer,
    payment: order.payment,
    status: order.status,
    statusUpdatedAt: order.statusUpdatedAt,
    invoice: order.invoice,
    shipmentIds: order.shipmentIds ?? [],
    assigned_to: order.assigned_to,
    cancelReason: order.cancelReason,
    cancelledAt: order.cancelledAt,
    cancelledByUserId: order.cancelledByUserId,
    externalOrderId: order.externalOrderId,
    source: order.source,
    lastSyncedAt: order.lastSyncedAt,
    lineItemCount: order.lineItemCount ?? order.lineItems?.length ?? 0,
    webhookPayloadRef: order.webhookPayloadRef,
    lastWebhookSyncFingerprint: order.lastWebhookSyncFingerprint,
    wooCommerceOrderId: order.wooCommerceOrderId,
    latestShipmentAwb: order.latestShipmentAwb,
    latestShipmentCarrierTrackingStatus: order.latestShipmentCarrierTrackingStatus,
    latestShipmentStatus: order.latestShipmentStatus,
    whatsappSentAt: order.whatsappSentAt,
    whatsappSentByUserId: order.whatsappSentByUserId,
    whatsappSentByUserName: order.whatsappSentByUserName,
    whatsappSentPhone: order.whatsappSentPhone,
    shipping: order.shipping,
    notes: order.notes,
    woocommerceOrderSnapshot: order.woocommerceOrderSnapshot,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  });
}

export function rowToOrder(row: OrderRow, lineItems?: Order["lineItems"]): Order {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customer: row.customer,
    payment: row.payment,
    status: row.status,
    statusUpdatedAt: row.status_updated_at as string | undefined,
    invoice: row.invoice as Order["invoice"],
    shipmentIds: (row.shipment_ids as string[] | null) ?? [],
    assigned_to: row.assigned_to as string | null | undefined,
    cancelReason: row.cancel_reason as string | undefined,
    cancelledAt: row.cancelled_at as string | undefined,
    cancelledByUserId: row.cancelled_by_user_id as string | undefined,
    externalOrderId: row.external_order_id as string | undefined,
    source: row.source as Order["source"],
    lastSyncedAt: row.last_synced_at as string | undefined,
    lineItemCount: row.line_item_count as number | undefined,
    webhookPayloadRef: row.webhook_payload_ref as string | undefined,
    lastWebhookSyncFingerprint: row.last_webhook_sync_fingerprint as string | undefined,
    wooCommerceOrderId: row.woocommerce_order_id as string | undefined,
    latestShipmentAwb: row.latest_shipment_awb as string | undefined,
    latestShipmentCarrierTrackingStatus:
      row.latest_shipment_carrier_tracking_status as string | undefined,
    latestShipmentStatus: row.latest_shipment_status as ShipmentStatus | undefined,
    whatsappSentAt: row.whatsapp_sent_at as string | undefined,
    whatsappSentByUserId: row.whatsapp_sent_by_user_id as string | undefined,
    whatsappSentByUserName: row.whatsapp_sent_by_user_name as string | undefined,
    whatsappSentPhone: row.whatsapp_sent_phone as string | undefined,
    shipping: row.shipping as Order["shipping"],
    notes: row.notes as string | undefined,
    woocommerceOrderSnapshot: row.woocommerce_order_snapshot as Order["woocommerceOrderSnapshot"],
    lineItems,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function queryOrdersListPage(
  tenantId: string,
  opts: OrderListQueryOpts,
  limit: number,
  cursor: OrderCursor | null,
): Promise<Order[]> {
  let q = getSupabaseServiceRoleClient()
    .from("orders")
    .select("*")
    .eq("tenant_id", tenantId);
  if (opts.statuses.length === 1) q = q.eq("status", opts.statuses[0]);
  else if (opts.statuses.length > 1) q = q.in("status", opts.statuses.slice(0, 10));
  if (opts.assignedTo) q = q.eq("assigned_to", opts.assignedTo);
  if (opts.payment) q = q.eq("payment->>payment_status", opts.payment);
  if (opts.shipping) q = q.eq("latest_shipment_status", opts.shipping);
  if (opts.from) q = q.gte("created_at", dateStartIso(opts.from));
  if (opts.to) q = q.lte("created_at", dateEndIso(opts.to));
  if (cursor) {
    q = q.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => rowToOrder(row as OrderRow));
}

export async function queryRecentOrderSummaries(
  tenantId: string,
  limit: number,
): Promise<Order[]> {
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("orders")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => rowToOrder(row as OrderRow));
}

export async function queryOrderByDocId(orderId: string): Promise<Order | null> {
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToOrder(data as OrderRow) : null;
}

export async function queryOrderByTenantAndField(
  tenantId: string,
  field: "wooCommerceOrderId" | "externalOrderId" | "customer.phone" | "customer.email",
  value: string,
  limitCount: number,
): Promise<Order[]> {
  const column =
    field === "wooCommerceOrderId"
      ? "woocommerce_order_id"
      : field === "externalOrderId"
        ? "external_order_id"
        : field === "customer.phone"
          ? "customer->>phone"
          : "customer->>email";
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("orders")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq(column, value)
    .limit(limitCount);
  if (error) throw error;
  return (data ?? []).map((row) => rowToOrder(row as OrderRow));
}

export async function findFirstOrderByTenantAndExternalWooId(
  tenantId: string,
  wooOrderId: string,
): Promise<{ id: string; data: Order } | null> {
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("orders")
    .select("*")
    .eq("tenant_id", tenantId)
    .or(`woocommerce_order_id.eq.${wooOrderId},external_order_id.eq.${wooOrderId}`)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, data: rowToOrder(data as OrderRow) } : null;
}

export async function setOrderDoc(orderId: string, order: Order): Promise<void> {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("orders")
    .upsert({ ...orderToRow(order), id: orderId });
  if (error) throw error;

  if (order.lineItems) {
    const { error: deleteError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", orderId);
    if (deleteError) throw deleteError;
    if (order.lineItems.length) {
      const { error: insertError } = await supabase.from("order_items").insert(
        order.lineItems.map((item) => ({
          id: item.id || crypto.randomUUID(),
          tenant_id: order.tenantId,
          order_id: orderId,
          product_id: item.product_id,
          variation_id: item.variation_id,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          unit_cost: item.unit_cost,
          line_cost: item.line_cost,
          product_url: item.product_url,
          attributes: item.attributes ?? {},
          meta: item.meta ?? {},
        })),
      );
      if (insertError) throw insertError;
    }
  }
}

export async function updateOrderDoc(
  orderId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await getSupabaseServiceRoleClient()
    .from("orders")
    .update(camelPatchToSnake(patch))
    .eq("id", orderId);
  if (error) throw error;
}

export async function getFullOrderDoc(
  tenantId: string,
  orderId: string,
): Promise<Order | null> {
  const { data: order, error } = await getSupabaseServiceRoleClient()
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return null;

  const { data: items, error: itemsError } = await getSupabaseServiceRoleClient()
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (itemsError) throw itemsError;

  const lineItems = (items ?? []).map((item) => ({
    id: item.id,
    product_id: item.product_id ?? undefined,
    variation_id: item.variation_id ?? undefined,
    name: item.name,
    sku: item.sku ?? undefined,
    quantity: item.quantity,
    unit_price: Number(item.unit_price ?? 0),
    line_total: Number(item.line_total ?? 0),
    unit_cost:
      item.unit_cost == null ? undefined : Number(item.unit_cost ?? 0),
    line_cost:
      item.line_cost == null ? undefined : Number(item.line_cost ?? 0),
    product_url: item.product_url ?? undefined,
    attributes: item.attributes ?? undefined,
    meta: item.meta ?? undefined,
  }));
  return rowToOrder(order as OrderRow, lineItems);
}
