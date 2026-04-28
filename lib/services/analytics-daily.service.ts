import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import type {
  AnalyticsDaily,
  Order,
  Shipment,
  ShipmentType,
  Ticket,
} from "@/lib/types/models";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockAnalyticsDailyIncrement,
  mockGetAnalyticsDailyDoc,
  mockRebuildAnalyticsDay,
} from "@/lib/dev/mock-backend";

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
    confirmed_orders_count: 0,
    shipments_count: 0,
    shipping_cost: 0,
    returns_count: 0,
    returns_value: 0,
    exchanges_count: 0,
    exchanges_value: 0,
  };
}

type AnalyticsDelta = Partial<{
  orders_count: number;
  orders_value: number;
  confirmed_orders_count: number;
  shipments_count: number;
  shipping_cost: number;
  returns_count: number;
  returns_value: number;
  exchanges_count: number;
  exchanges_value: number;
}>;

async function applyIncrement(input: {
  tenantId: string;
  date: string;
  deltas: AnalyticsDelta;
}) {
  if (isDevMockDataEnabled()) {
    mockAnalyticsDailyIncrement(input);
    return;
  }
  const db = getDb();
  const id = analyticsDailyDocId(input.tenantId, input.date);
  const ref = db.collection(COLLECTIONS.analyticsDaily).doc(id);
  const payload: Record<string, unknown> = {
    id,
    tenantId: input.tenantId,
    date: input.date,
    updatedAt: new Date().toISOString(),
  };
  for (const [key, raw] of Object.entries(input.deltas)) {
    if (raw == null || raw === 0) continue;
    payload[key] = FieldValue.increment(raw);
  }
  await ref.set(payload, { merge: true });
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

/** Delivery shipment created. Bucket: shipment.createdAt. Only `delivery` counts toward shipping KPIs. */
export async function recordDeliveryShipmentAnalytics(input: {
  tenantId: string;
  shipmentCreatedAt: string;
  type: ShipmentType;
  shippingCost: number;
}) {
  if (input.type !== "delivery") return;
  const date = dateKeyFromIso(input.shipmentCreatedAt);
  await applyIncrement({
    tenantId: input.tenantId,
    date,
    deltas: {
      shipments_count: 1,
      shipping_cost: input.shippingCost,
    },
  });
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
      deltas: {
        returns_count: 1,
        returns_value: input.orderValue,
      },
    });
    return;
  }
  if (input.ticket.type === "exchange") {
    await applyIncrement({
      tenantId: input.ticket.tenantId,
      date,
      deltas: {
        exchanges_count: 1,
        exchanges_value: 0,
      },
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
  const db = getDb();
  const id = analyticsDailyDocId(tenantId, date);
  const snap = await db.collection(COLLECTIONS.analyticsDaily).doc(id).get();
  if (!snap.exists) {
    const base = emptyAnalyticsRow(tenantId, date);
    return { ...base, updatedAt: new Date().toISOString() };
  }
  const d = snap.data() as Record<string, unknown>;
  const base = emptyAnalyticsRow(tenantId, date);
  return {
    ...base,
    orders_count: asNumber(d.orders_count),
    orders_value: asNumber(d.orders_value),
    confirmed_orders_count: asNumber(d.confirmed_orders_count),
    shipments_count: asNumber(d.shipments_count),
    shipping_cost: asNumber(d.shipping_cost),
    returns_count: asNumber(d.returns_count),
    returns_value: asNumber(d.returns_value),
    exchanges_count: asNumber(d.exchanges_count),
    exchanges_value: asNumber(d.exchanges_value),
    updatedAt: (d.updatedAt as string) ?? new Date().toISOString(),
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
      confirmed_orders_count:
        acc.confirmed_orders_count + row.confirmed_orders_count,
      shipments_count: acc.shipments_count + row.shipments_count,
      shipping_cost: acc.shipping_cost + row.shipping_cost,
      returns_count: acc.returns_count + row.returns_count,
      returns_value: acc.returns_value + row.returns_value,
      exchanges_count: acc.exchanges_count + row.exchanges_count,
      exchanges_value: acc.exchanges_value + row.exchanges_value,
    }),
    {
      orders_count: 0,
      orders_value: 0,
      confirmed_orders_count: 0,
      shipments_count: 0,
      shipping_cost: 0,
      returns_count: 0,
      returns_value: 0,
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

  const db = getDb();
  const [orderSnaps, shipSnaps, ticketSnaps] = await Promise.all([
    db
      .collection(COLLECTIONS.orders)
      .where("tenantId", "==", tenantId)
      .limit(REBUILD_LIMIT)
      .get(),
    db
      .collection(COLLECTIONS.shipments)
      .where("tenantId", "==", tenantId)
      .limit(REBUILD_LIMIT)
      .get(),
    db
      .collection(COLLECTIONS.tickets)
      .where("tenantId", "==", tenantId)
      .limit(REBUILD_LIMIT)
      .get(),
  ]);

  const orders = orderSnaps.docs.map((d) => d.data() as Order);
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const shipments = shipSnaps.docs.map((d) => d.data() as Shipment);
  const tickets = ticketSnaps.docs.map((d) => d.data() as Ticket);

  let orders_count = 0;
  let orders_value = 0;
  for (const o of orders) {
    if (dateKeyFromIso(o.createdAt) !== date) continue;
    orders_count += 1;
    orders_value += o.payment.total_amount;
  }

  let confirmed_orders_count = 0;
  try {
    const logSnaps = await db
      .collection(COLLECTIONS.activityLogs)
      .where("tenantId", "==", tenantId)
      .where("action", "==", "order.status.confirmed")
      .limit(REBUILD_LIMIT)
      .get();
    for (const doc of logSnaps.docs) {
      const ts = (doc.data() as { timestamp?: string }).timestamp ?? "";
      if (dateKeyFromIso(ts) !== date) continue;
      confirmed_orders_count += 1;
    }
  } catch {
    confirmed_orders_count = 0;
  }

  let shipments_count = 0;
  let shipping_cost = 0;
  for (const sh of shipments) {
    if (sh.type !== "delivery" || dateKeyFromIso(sh.createdAt) !== date) {
      continue;
    }
    shipments_count += 1;
    const order = orderById.get(sh.order_id);
    const fee =
      sh.shipping_fees ??
      order?.shipping?.cost ??
      0;
    shipping_cost += fee;
  }

  let returns_count = 0;
  let returns_value = 0;
  let exchanges_count = 0;
  for (const t of tickets) {
    if (dateKeyFromIso(t.createdAt) !== date) continue;
    if (t.type === "return") {
      returns_count += 1;
      const o = orderById.get(t.order_id);
      returns_value += o?.payment.total_amount ?? 0;
    } else if (t.type === "exchange") {
      exchanges_count += 1;
    }
  }

  const exchanges_value = 0;
  const id = analyticsDailyDocId(tenantId, date);
  const row: AnalyticsDaily = {
    id,
    tenantId,
    date,
    orders_count,
    orders_value,
    confirmed_orders_count,
    shipments_count,
    shipping_cost,
    returns_count,
    returns_value,
    exchanges_count,
    exchanges_value,
    updatedAt: new Date().toISOString(),
  };

  await db.collection(COLLECTIONS.analyticsDaily).doc(id).set(row);
  return row;
}
