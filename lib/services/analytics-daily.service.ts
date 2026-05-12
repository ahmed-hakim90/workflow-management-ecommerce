import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import type {
  AnalyticsDaily,
  Order,
  Shipment,
  ShipmentType,
  ShippingProvider,
  Ticket,
} from "@/lib/types/models";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockAnalyticsDailyIncrement,
  mockGetAnalyticsDailyDoc,
  mockRebuildAnalyticsDay,
} from "@/lib/dev/mock-backend";
import { listOrders } from "@/lib/services/orders.service";
import { listShipmentsForTenant } from "@/lib/services/shipments.service";
import { listTickets } from "@/lib/services/tickets.service";

/** Daily bucket uses the UTC calendar date (YYYY-MM-DD) of an ISO-8601 timestamp. */
export function dateKeyFromIso(iso: string): string {
  return iso.slice(0, 10);
}

export function analyticsDailyDocId(tenantId: string, date: string): string {
  return `${tenantId}_${date}`;
}

function emptyAnalyticsRow(
  tenantId: string,
  date: string,
): Omit<AnalyticsDaily, "updatedAt"> {
  const id = analyticsDailyDocId(tenantId, date);
  return {
    id,
    tenantId,
    date,
    orders_count: 0,
    orders_value: 0,
    cogs_value: 0,
    confirmed_orders_count: 0,
    shipments_count: 0,
    shipping_cost: 0,
    delivery_shipments_count: 0,
    delivery_shipping_cost: 0,
    return_shipments_count: 0,
    return_shipping_cost: 0,
    exchange_shipments_count: 0,
    exchange_shipping_cost: 0,
    returns_count: 0,
    returns_value: 0,
    refunds_value: 0,
    exchanges_count: 0,
    exchanges_value: 0,
  };
}

type AnalyticsDelta = Partial<{
  orders_count: number;
  orders_value: number;
  cogs_value: number;
  confirmed_orders_count: number;
  shipments_count: number;
  shipping_cost: number;
  delivery_shipments_count: number;
  delivery_shipping_cost: number;
  return_shipments_count: number;
  return_shipping_cost: number;
  exchange_shipments_count: number;
  exchange_shipping_cost: number;
  returns_count: number;
  returns_value: number;
  refunds_value: number;
  exchanges_count: number;
  exchanges_value: number;
}>;

const ANALYTICS_NUMBER_KEYS = [
  "orders_count",
  "orders_value",
  "cogs_value",
  "confirmed_orders_count",
  "shipments_count",
  "shipping_cost",
  "delivery_shipments_count",
  "delivery_shipping_cost",
  "return_shipments_count",
  "return_shipping_cost",
  "exchange_shipments_count",
  "exchange_shipping_cost",
  "returns_count",
  "returns_value",
  "refunds_value",
  "exchanges_count",
  "exchanges_value",
] as const satisfies readonly (keyof AnalyticsDelta)[];

type AnalyticsNumberKey = (typeof ANALYTICS_NUMBER_KEYS)[number];

function analyticsMetrics(row: AnalyticsDaily): Record<AnalyticsNumberKey, number> {
  return Object.fromEntries(
    ANALYTICS_NUMBER_KEYS.map((key) => [key, asNumber(row[key])]),
  ) as Record<AnalyticsNumberKey, number>;
}

export function orderCogsValue(order: Pick<Order, "lineItems">): number {
  return (order.lineItems ?? []).reduce((sum, item) => {
    const explicitLineCost =
      typeof item.line_cost === "number" && Number.isFinite(item.line_cost)
        ? item.line_cost
        : undefined;
    const unitCost =
      typeof item.unit_cost === "number" && Number.isFinite(item.unit_cost)
        ? item.unit_cost
        : undefined;
    return sum + Math.max(0, explicitLineCost ?? (unitCost ?? 0) * item.quantity);
  }, 0);
}

function ticketFinancialValue(ticket: Ticket, fallbackOrderValue: number): number {
  const refund = ticket.resolution?.refundAmount;
  if (typeof refund === "number" && Number.isFinite(refund)) {
    return Math.max(0, refund);
  }
  return Math.max(0, fallbackOrderValue);
}

function shipmentCost(shipment: Shipment, order?: Order): number {
  return Math.max(0, shipment.shipping_fees ?? order?.shipping?.cost ?? 0);
}

function shipmentDeltas(type: ShipmentType, shippingCost: number): AnalyticsDelta {
  const base: AnalyticsDelta = {
    shipments_count: 1,
    shipping_cost: shippingCost,
  };
  if (type === "delivery") {
    return {
      ...base,
      delivery_shipments_count: 1,
      delivery_shipping_cost: shippingCost,
    };
  }
  if (type === "return") {
    return {
      ...base,
      return_shipments_count: 1,
      return_shipping_cost: shippingCost,
    };
  }
  return {
    ...base,
    exchange_shipments_count: 1,
    exchange_shipping_cost: shippingCost,
  };
}

async function applyIncrement(input: {
  tenantId: string;
  date: string;
  deltas: AnalyticsDelta;
}) {
  if (isDevMockDataEnabled()) {
    mockAnalyticsDailyIncrement(input);
    return;
  }
  const id = analyticsDailyDocId(input.tenantId, input.date);
  const current = await getAnalyticsDailyDoc(input.tenantId, input.date);
  const metrics = analyticsMetrics(current);
  for (const [key, raw] of Object.entries(input.deltas)) {
    if (raw == null || raw === 0) continue;
    const metricKey = key as AnalyticsNumberKey;
    if (!ANALYTICS_NUMBER_KEYS.includes(metricKey)) continue;
    metrics[metricKey] = asNumber(metrics[metricKey]) + raw;
  }
  const { error } = await getSupabaseServiceRoleClient()
    .from("analytics_daily")
    .upsert({
      id,
      tenant_id: input.tenantId,
      date: input.date,
      metrics,
    });
  if (error) throw error;
}

/** New order ingested (WooCommerce create). Bucket: order.createdAt (UTC day). */
export async function recordNewOrderAnalytics(order: Order) {
  const date = dateKeyFromIso(order.createdAt);
  await applyIncrement({
    tenantId: order.tenantId,
    date,
    deltas: {
      orders_count: 1,
      orders_value: order.payment.total_amount,
      cogs_value: orderCogsValue(order),
    },
  });
}

/** Order deleted. Bucket: original order.createdAt (UTC day). */
export async function recordOrderDeletedAnalytics(order: Order) {
  const date = dateKeyFromIso(order.createdAt);
  await applyIncrement({
    tenantId: order.tenantId,
    date,
    deltas: {
      orders_count: -1,
      orders_value: -order.payment.total_amount,
      cogs_value: -orderCogsValue(order),
    },
  });
}

/** Staff confirmed an order. Bucket: confirmation time (UTC day). */
export async function recordOrderConfirmedAnalytics(input: {
  tenantId: string;
  atIso: string;
}) {
  const date = dateKeyFromIso(input.atIso);
  await applyIncrement({
    tenantId: input.tenantId,
    date,
    deltas: { confirmed_orders_count: 1 },
  });
}

/** Shipment created. Bucket: shipment.createdAt. Tracks all carrier spend with type-specific splits. */
export async function recordDeliveryShipmentAnalytics(input: {
  tenantId: string;
  shipmentCreatedAt: string;
  type: ShipmentType;
  shippingCost: number;
}) {
  const date = dateKeyFromIso(input.shipmentCreatedAt);
  await applyIncrement({
    tenantId: input.tenantId,
    date,
    deltas: shipmentDeltas(input.type, input.shippingCost),
  });
}

export async function recordShipmentShippingCostAdjustment(input: {
  tenantId: string;
  shipmentCreatedAt: string;
  type: ShipmentType;
  previousCost: number;
  nextCost: number;
}) {
  const delta = input.nextCost - input.previousCost;
  if (Math.abs(delta) < 0.01) return;
  const date = dateKeyFromIso(input.shipmentCreatedAt);
  const deltas = shipmentDeltas(input.type, delta);
  delete deltas.shipments_count;
  delete deltas.delivery_shipments_count;
  delete deltas.return_shipments_count;
  delete deltas.exchange_shipments_count;
  await applyIncrement({ tenantId: input.tenantId, date, deltas });
}

/** Ticket opened. Bucket: ticket.createdAt. */
export async function recordTicketOpenedAnalytics(input: {
  ticket: Ticket;
  orderValue: number;
}) {
  const date = dateKeyFromIso(input.ticket.createdAt);
  if (input.ticket.type === "return") {
    await applyIncrement({
      tenantId: input.ticket.tenantId,
      date,
      deltas: { returns_count: 1 },
    });
    return;
  }
  if (input.ticket.type === "exchange") {
    await applyIncrement({
      tenantId: input.ticket.tenantId,
      date,
      deltas: {
        exchanges_count: 1,
      },
    });
  }
}

/** Ticket resolved. Bucket: resolution time; stores actual refund/exchange values. */
export async function recordTicketResolvedAnalytics(input: {
  ticket: Ticket;
  orderValue: number;
}) {
  const resolvedAt = input.ticket.resolution?.resolvedAt;
  if (!resolvedAt) return;
  const value = ticketFinancialValue(input.ticket, input.orderValue);
  if (value <= 0) return;
  const date = dateKeyFromIso(resolvedAt);
  if (
    input.ticket.type === "return" ||
    input.ticket.resolution?.kind === "refund_without_shipment"
  ) {
    await applyIncrement({
      tenantId: input.ticket.tenantId,
      date,
      deltas: {
        returns_value: value,
        refunds_value: value,
      },
    });
    return;
  }
  if (input.ticket.type === "exchange") {
    await applyIncrement({
      tenantId: input.ticket.tenantId,
      date,
      deltas: { exchanges_value: value },
    });
  }
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
}

export async function getAnalyticsDailyDoc(
  tenantId: string,
  date: string,
): Promise<AnalyticsDaily> {
  if (isDevMockDataEnabled()) {
    return mockGetAnalyticsDailyDoc(tenantId, date);
  }
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("analytics_daily")
    .select("metrics, updated_at")
    .eq("tenant_id", tenantId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const base = emptyAnalyticsRow(tenantId, date);
    return { ...base, updatedAt: new Date().toISOString() };
  }
  const d = (data.metrics ?? {}) as Record<string, unknown>;
  const base = emptyAnalyticsRow(tenantId, date);
  return {
    ...base,
    orders_count: asNumber(d.orders_count),
    orders_value: asNumber(d.orders_value),
    cogs_value: asNumber(d.cogs_value),
    confirmed_orders_count: asNumber(d.confirmed_orders_count),
    shipments_count: asNumber(d.shipments_count),
    shipping_cost: asNumber(d.shipping_cost),
    delivery_shipments_count: asNumber(d.delivery_shipments_count),
    delivery_shipping_cost: asNumber(d.delivery_shipping_cost),
    return_shipments_count: asNumber(d.return_shipments_count),
    return_shipping_cost: asNumber(d.return_shipping_cost),
    exchange_shipments_count: asNumber(d.exchange_shipments_count),
    exchange_shipping_cost: asNumber(d.exchange_shipping_cost),
    returns_count: asNumber(d.returns_count),
    returns_value: asNumber(d.returns_value),
    refunds_value: asNumber(d.refunds_value),
    exchanges_count: asNumber(d.exchanges_count),
    exchanges_value: asNumber(d.exchanges_value),
    updatedAt: data.updated_at ?? new Date().toISOString(),
  };
}

/** Sum daily docs for [from, to] inclusive (UTC dates YYYY-MM-DD). */
export async function aggregateAnalyticsRange(input: {
  tenantId: string;
  from: string;
  to: string;
}): Promise<{
  totals: Omit<AnalyticsDaily, "id" | "tenantId" | "date" | "updatedAt">;
  series: AnalyticsDaily[];
}> {
  const series: AnalyticsDaily[] = [];
  for (const date of eachDateInRange(input.from, input.to)) {
    series.push(await getAnalyticsDailyDoc(input.tenantId, date));
  }

  const totals = series.reduce(
    (acc, row) => ({
      orders_count: acc.orders_count + row.orders_count,
      orders_value: acc.orders_value + row.orders_value,
      cogs_value: acc.cogs_value + row.cogs_value,
      confirmed_orders_count:
        acc.confirmed_orders_count + row.confirmed_orders_count,
      shipments_count: acc.shipments_count + row.shipments_count,
      shipping_cost: acc.shipping_cost + row.shipping_cost,
      delivery_shipments_count:
        acc.delivery_shipments_count + row.delivery_shipments_count,
      delivery_shipping_cost:
        acc.delivery_shipping_cost + row.delivery_shipping_cost,
      return_shipments_count:
        acc.return_shipments_count + row.return_shipments_count,
      return_shipping_cost:
        acc.return_shipping_cost + row.return_shipping_cost,
      exchange_shipments_count:
        acc.exchange_shipments_count + row.exchange_shipments_count,
      exchange_shipping_cost:
        acc.exchange_shipping_cost + row.exchange_shipping_cost,
      returns_count: acc.returns_count + row.returns_count,
      returns_value: acc.returns_value + row.returns_value,
      refunds_value: acc.refunds_value + row.refunds_value,
      exchanges_count: acc.exchanges_count + row.exchanges_count,
      exchanges_value: acc.exchanges_value + row.exchanges_value,
    }),
    {
      orders_count: 0,
      orders_value: 0,
      cogs_value: 0,
      confirmed_orders_count: 0,
      shipments_count: 0,
      shipping_cost: 0,
      delivery_shipments_count: 0,
      delivery_shipping_cost: 0,
      return_shipments_count: 0,
      return_shipping_cost: 0,
      exchange_shipments_count: 0,
      exchange_shipping_cost: 0,
      returns_count: 0,
      returns_value: 0,
      refunds_value: 0,
      exchanges_count: 0,
      exchanges_value: 0,
    },
  );

  return { totals, series };
}

function eachDateInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const a = new Date(`${from}T00:00:00.000Z`).getTime();
  const b = new Date(`${to}T00:00:00.000Z`).getTime();
  if (a > b) return out;
  for (let t = a; t <= b; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

const REBUILD_LIMIT = 3000;

/**
 * Overwrites one UTC day's `analytics_daily` doc from operational collections (reconciliation).
 */
export async function rebuildAnalyticsDay(
  tenantId: string,
  date: string,
): Promise<AnalyticsDaily> {
  if (isDevMockDataEnabled()) {
    return mockRebuildAnalyticsDay(tenantId, date);
  }

  const [orders, shipments, tickets] = await Promise.all([
    listOrders(tenantId, { limit: REBUILD_LIMIT }),
    listShipmentsForTenant(tenantId),
    listTickets(tenantId),
  ]);
  const orderById = new Map(orders.map((o) => [o.id, o]));

  let orders_count = 0;
  let orders_value = 0;
  let cogs_value = 0;
  for (const o of orders) {
    if (dateKeyFromIso(o.createdAt) !== date) continue;
    orders_count += 1;
    orders_value += o.payment.total_amount;
    cogs_value += orderCogsValue(o);
  }

  let confirmed_orders_count = 0;
  try {
    confirmed_orders_count = orders.filter(
      (o) => o.statusUpdatedAt && dateKeyFromIso(o.statusUpdatedAt) === date,
    ).length;
  } catch {
    confirmed_orders_count = 0;
  }

  let shipments_count = 0;
  let shipping_cost = 0;
  let delivery_shipments_count = 0;
  let delivery_shipping_cost = 0;
  let return_shipments_count = 0;
  let return_shipping_cost = 0;
  let exchange_shipments_count = 0;
  let exchange_shipping_cost = 0;
  for (const sh of shipments) {
    if (dateKeyFromIso(sh.createdAt) !== date) {
      continue;
    }
    shipments_count += 1;
    const order = orderById.get(sh.order_id);
    const fee = shipmentCost(sh, order);
    shipping_cost += fee;
    if (sh.type === "delivery") {
      delivery_shipments_count += 1;
      delivery_shipping_cost += fee;
    } else if (sh.type === "return") {
      return_shipments_count += 1;
      return_shipping_cost += fee;
    } else if (sh.type === "exchange") {
      exchange_shipments_count += 1;
      exchange_shipping_cost += fee;
    }
  }

  let returns_count = 0;
  let returns_value = 0;
  let refunds_value = 0;
  let exchanges_count = 0;
  let exchanges_value = 0;
  for (const t of tickets) {
    if (dateKeyFromIso(t.createdAt) !== date) continue;
    if (t.type === "return") {
      returns_count += 1;
    } else if (t.type === "exchange") {
      exchanges_count += 1;
    }
  }
  for (const t of tickets) {
    if (!t.resolution?.resolvedAt || dateKeyFromIso(t.resolution.resolvedAt) !== date) {
      continue;
    }
    const value = ticketFinancialValue(t, orderById.get(t.order_id)?.payment.total_amount ?? 0);
    if (t.type === "return" || t.resolution.kind === "refund_without_shipment") {
      returns_value += value;
      refunds_value += value;
    } else if (t.type === "exchange") {
      exchanges_value += value;
    }
  }

  const id = analyticsDailyDocId(tenantId, date);
  const row: AnalyticsDaily = {
    id,
    tenantId,
    date,
    orders_count,
    orders_value,
    cogs_value,
    confirmed_orders_count,
    shipments_count,
    shipping_cost,
    delivery_shipments_count,
    delivery_shipping_cost,
    return_shipments_count,
    return_shipping_cost,
    exchange_shipments_count,
    exchange_shipping_cost,
    returns_count,
    returns_value,
    refunds_value,
    exchanges_count,
    exchanges_value,
    updatedAt: new Date().toISOString(),
  };

  const { error: upsertError } = await getSupabaseServiceRoleClient()
    .from("analytics_daily")
    .upsert({
      id,
      tenant_id: tenantId,
      date,
      metrics: analyticsMetrics(row),
      updated_at: row.updatedAt,
    });
  if (upsertError) throw upsertError;
  return row;
}

export type CarrierFinancialRow = {
  provider: ShippingProvider;
  shipments_count: number;
  delivery_count: number;
  return_count: number;
  exchange_count: number;
  cancelled_count: number;
  failed_count: number;
  delivered_count: number;
  shipping_cost: number;
  delivery_cost: number;
  return_cost: number;
  exchange_cost: number;
  total_debit: number;
  cod_delivered: number;
  cod_active: number;
  total_credit: number;
  net_balance: number;
  average_cost: number;
};

function emptyCarrierFinancialRow(provider: ShippingProvider): CarrierFinancialRow {
  return {
    provider,
    shipments_count: 0,
    delivery_count: 0,
    return_count: 0,
    exchange_count: 0,
    cancelled_count: 0,
    failed_count: 0,
    delivered_count: 0,
    shipping_cost: 0,
    delivery_cost: 0,
    return_cost: 0,
    exchange_cost: 0,
    total_debit: 0,
    cod_delivered: 0,
    cod_active: 0,
    total_credit: 0,
    net_balance: 0,
    average_cost: 0,
  };
}

export async function aggregateCarrierFinancials(input: {
  tenantId: string;
  from: string;
  to: string;
}): Promise<CarrierFinancialRow[]> {
  const shipments = await listShipmentsForTenant(input.tenantId, {
    from: input.from,
    to: input.to,
  });
  const rows = new Map<ShippingProvider, CarrierFinancialRow>();
  for (const sh of shipments) {
    const row = rows.get(sh.provider) ?? emptyCarrierFinancialRow(sh.provider);
    const fee = Math.max(0, sh.shipping_fees ?? 0);
    const cod = Math.max(0, sh.cod_amount ?? 0);
    row.shipments_count += 1;
    row.shipping_cost += fee;
    if (sh.type === "delivery") {
      row.delivery_count += 1;
      row.delivery_cost += fee;
      if (sh.status === "delivered") {
        row.cod_delivered += cod;
      } else if (sh.status !== "cancelled" && sh.status !== "failed") {
        row.cod_active += cod;
      }
    }
    if (sh.type === "return") {
      row.return_count += 1;
      row.return_cost += fee;
    }
    if (sh.type === "exchange") {
      row.exchange_count += 1;
      row.exchange_cost += fee;
    }
    if (sh.status === "cancelled") row.cancelled_count += 1;
    if (sh.status === "failed") row.failed_count += 1;
    if (sh.status === "delivered") row.delivered_count += 1;
    rows.set(sh.provider, row);
  }
  return [...rows.values()]
    .map((row) => ({
      ...row,
      total_debit: row.delivery_cost + row.return_cost + row.exchange_cost,
      total_credit: row.cod_delivered,
      net_balance:
        row.delivery_cost +
        row.return_cost +
        row.exchange_cost -
        row.cod_delivered,
      average_cost:
        row.shipments_count > 0 ? row.shipping_cost / row.shipments_count : 0,
    }))
    .sort((a, b) => Math.abs(b.net_balance) - Math.abs(a.net_balance));
}
