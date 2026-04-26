/**
 * In-memory backend for developer mock mode.
 * Keeps behavior close to Firestore services without external DB.
 */
import { buildPayment } from "@/lib/logic/payment";
import { assertTransition } from "@/lib/logic/order-state-machine";
import {
  assertWarehouseRevert,
  assertWarehouseScanTransition,
} from "@/lib/logic/order-state-machine-warehouse";
import {
  shouldAutoCreateShipment,
  orderNeedsDeliveryShipment,
} from "@/lib/logic/automation";
import {
  defaultTenantAutomation,
  defaultTenantWarehouse,
  type ActivityEntityType,
  type ActivityLog,
  type Order,
  type OrderStatus,
  type Shipment,
  type ShipmentStatus,
  type ShipmentType,
  type Ticket,
  type TicketStatus,
  type User,
  type UserRole,
  type UserStats,
  type TenantAutomationSettings,
  type TenantIntegrationsDoc,
  type TenantKanbanSettings,
  type AnalyticsDaily,
  type Tenant,
  type TenantWarehouseSettings,
  type WebhookIngestLog,
} from "@/lib/types/models";
import { slugify } from "@/lib/string/slugify";

const DEMO_TENANT = "default";

type MockState = {
  orders: Order[];
  shipments: Shipment[];
  tickets: Ticket[];
  users: User[];
  userStats: Record<string, UserStats>;
  /** Key: `${tenantId}_${YYYY-MM-DD}` — financial aggregates (mock Firestore `analytics_daily`). */
  analyticsDaily: Record<string, AnalyticsDaily>;
  tenantAutomation: Record<string, TenantAutomationSettings>;
  tenantIntegrations: Record<string, TenantIntegrationsDoc>;
  tenantKanban: Record<string, TenantKanbanSettings>;
  activityLogs: ActivityLog[];
  webhookIngestLogs: WebhookIngestLog[];
  integrationKeys: Set<string>;
  tenants: Record<string, Tenant>;
};

let state: MockState | null = null;

function iso() {
  return new Date().toISOString();
}

function createSeed(): MockState {
  const t0 = "2026-04-20T10:00:00.000Z";
  const users: User[] = [
    {
      id: "user-admin-1",
      tenantId: DEMO_TENANT,
      name: "مدير النظام",
      email: "admin@Store.local",
      role: "admin",
      permissions: [],
      daily_target: 25,
      createdAt: t0,
      updatedAt: t0,
    },
    {
      id: "user-confirm-1",
      tenantId: DEMO_TENANT,
      name: "فريق التأكيد",
      email: "confirm@Store.local",
      role: "confirmation",
      permissions: [],
      daily_target: 15,
      createdAt: t0,
      updatedAt: t0,
    },
    {
      id: "user-warehouse-1",
      tenantId: DEMO_TENANT,
      name: "مخزن القاهرة",
      email: "wh@Store.local",
      role: "warehouse",
      permissions: [],
      daily_target: 40,
      createdAt: t0,
      updatedAt: t0,
    },
  ];

  const oid1 = "a1111111-1111-4111-8111-111111111101";
  const oid2 = "a2222222-2222-4222-8222-222222222202";
  const oid3 = "a3333333-3333-4333-8333-333333333303";
  const oid4 = "a4444444-4444-4444-8444-444444444404";
  const oid5 = "a5555555-5555-4555-8555-555555555505";
  const oid6 = "a6666666-6666-4666-8666-666666666606";

  const orders: Order[] = [
    {
      id: oid1,
      tenantId: DEMO_TENANT,
      customer: {
        name: "أحمد علي",
        phone: "01001234567",
        email: "a@ex.test",
        address: "القاهرة، مصر",
      },
      payment: buildPayment({
        payment_status: "cod",
        total_amount: 1299.5,
        paid_amount: 0,
      }),
      status: "pending_confirmation",
      shipmentIds: [],
      wooCommerceOrderId: "wc-5001",
      lineItems: [
        {
          name: "سماعة لاسلكية",
          sku: "SKU-HP-01",
          quantity: 1,
          unit_price: 1199.5,
          line_total: 1199.5,
        },
        {
          name: "شحن سريع",
          sku: "SHIP-EXP",
          quantity: 1,
          unit_price: 100,
          line_total: 100,
        },
      ],
      shipping: { method: "شحن سريع", cost: 100 },
      createdAt: t0,
      updatedAt: "2026-04-24T08:00:00.000Z",
    },
    {
      id: oid2,
      tenantId: DEMO_TENANT,
      customer: { name: "سارة محمود", phone: "01009876543" },
      payment: buildPayment({
        payment_status: "paid",
        total_amount: 450,
        paid_amount: 450,
      }),
      status: "confirmed",
      shipmentIds: [],
      assigned_to: "user-confirm-1",
      wooCommerceOrderId: "wc-5002",
      lineItems: [
        {
          name: "تيشيرت قطن",
          sku: "SKU-TS-12",
          quantity: 2,
          unit_price: 200,
          line_total: 400,
        },
        {
          name: "شحن عادي",
          quantity: 1,
          unit_price: 50,
          line_total: 50,
        },
      ],
      shipping: { method: "عادي", cost: 50 },
      createdAt: t0,
      updatedAt: "2026-04-24T09:00:00.000Z",
    },
    {
      id: oid3,
      tenantId: DEMO_TENANT,
      customer: { name: "محمد إبراهيم", phone: "01112223334" },
      payment: buildPayment({
        payment_status: "partial",
        total_amount: 2100,
        paid_amount: 1000,
      }),
      status: "invoicing",
      invoice: { number: "INV-1042", issuedAt: "2026-04-24T10:00:00.000Z" },
      shipmentIds: [],
      createdAt: t0,
      updatedAt: "2026-04-24T10:30:00.000Z",
    },
    {
      id: oid4,
      tenantId: DEMO_TENANT,
      customer: { name: "ليلى حسن", phone: "01550001112" },
      payment: buildPayment({
        payment_status: "paid",
        total_amount: 899,
        paid_amount: 899,
      }),
      status: "ready_for_warehouse",
      invoice: { number: "INV-1043", issuedAt: "2026-04-24T11:00:00.000Z" },
      shipmentIds: ["ship-demo-001"],
      createdAt: t0,
      updatedAt: "2026-04-24T11:15:00.000Z",
    },
    {
      id: oid5,
      tenantId: DEMO_TENANT,
      customer: { name: "كريم فؤاد", phone: "01005556677" },
      payment: buildPayment({
        payment_status: "cod",
        total_amount: 340,
        paid_amount: 0,
      }),
      status: "packed",
      shipmentIds: ["ship-demo-002"],
      createdAt: t0,
      updatedAt: "2026-04-24T12:00:00.000Z",
    },
    {
      id: oid6,
      tenantId: DEMO_TENANT,
      customer: { name: "نورا كمال", phone: "01227778899" },
      payment: buildPayment({
        payment_status: "paid",
        total_amount: 1750.25,
        paid_amount: 1750.25,
      }),
      status: "shipped",
      shipmentIds: ["ship-demo-003"],
      createdAt: t0,
      updatedAt: "2026-04-24T14:00:00.000Z",
    },
  ];

  const shipments: Shipment[] = [
    {
      id: "ship-demo-001",
      tenantId: DEMO_TENANT,
      order_id: oid4,
      awb: "MOCK-DEMO-001",
      type: "delivery",
      status: "created",
      provider: "mock",
      createdByUserId: "user-admin-1",
      createdByUserName: "مدير النظام",
      createdAt: t0,
      updatedAt: t0,
    },
    {
      id: "ship-demo-002",
      tenantId: DEMO_TENANT,
      order_id: oid5,
      awb: "MOCK-DEMO-002",
      type: "delivery",
      status: "packed",
      provider: "mock",
      createdByUserId: "user-warehouse-1",
      createdByUserName: "مخزن القاهرة",
      packedAt: "2026-04-24T12:00:00.000Z",
      createdAt: t0,
      updatedAt: "2026-04-24T12:00:00.000Z",
    },
    {
      id: "ship-demo-003",
      tenantId: DEMO_TENANT,
      order_id: oid6,
      awb: "MOCK-DEMO-003",
      type: "delivery",
      status: "shipped",
      provider: "mock",
      createdByUserId: "user-admin-1",
      createdByUserName: "مدير النظام",
      shippedAt: "2026-04-24T14:00:00.000Z",
      createdAt: t0,
      updatedAt: "2026-04-24T14:00:00.000Z",
    },
  ];

  const tickets: Ticket[] = [
    {
      id: "ticket-demo-1",
      tenantId: DEMO_TENANT,
      order_id: oid1,
      type: "complaint",
      status: "open",
      notes: "تأخير في التأكيد — بيانات وهمية",
      shipmentIds: [],
      createdAt: t0,
      updatedAt: "2026-04-24T08:30:00.000Z",
    },
    {
      id: "ticket-demo-2",
      tenantId: DEMO_TENANT,
      order_id: oid2,
      type: "return",
      status: "in_progress",
      assigned_to: "user-admin-1",
      shipmentIds: [],
      createdAt: t0,
      updatedAt: "2026-04-24T09:30:00.000Z",
    },
  ];

  const date = new Date().toISOString().slice(0, 10);
  const userStats: Record<string, UserStats> = {
    [`${DEMO_TENANT}_user-admin-1_${date}`]: {
      id: `${DEMO_TENANT}_user-admin-1_${date}`,
      tenantId: DEMO_TENANT,
      userId: "user-admin-1",
      date,
      confirmed: 3,
      invoiced: 2,
      packed: 4,
      updatedAt: iso(),
    },
  };

  const demoTenant: Tenant = {
    id: DEMO_TENANT,
    name: "Demo Company",
    slug: "demo",
    ownerUserId: "user-admin-1",
    staffApiKey: "demo-staff-api-key-mock-only",
    createdAt: t0,
    updatedAt: t0,
  };

  const st: MockState = {
    orders,
    shipments,
    tickets,
    users,
    userStats,
    analyticsDaily: {},
    tenantAutomation: {
      [DEMO_TENANT]: { ...defaultTenantAutomation },
    },
    tenantIntegrations: {},
    tenantKanban: {},
    activityLogs: [],
    webhookIngestLogs: [],
    integrationKeys: new Set(),
    tenants: { [DEMO_TENANT]: demoTenant },
  };
  state = st;
  mockRebuildAnalyticsDay(DEMO_TENANT, "2026-04-20");
  mockRebuildAnalyticsDay(DEMO_TENANT, new Date().toISOString().slice(0, 10));
  return st;
}

function ctx(): MockState {
  if (!state) state = createSeed();
  return state;
}

function effectiveWarehouseForMock(tenantId: string) {
  const w = ctx().tenantIntegrations[tenantId]?.warehouse;
  return {
    singleScanFulfills: w?.singleScanFulfills ?? false,
    scanCooldownMs: Math.max(
      0,
      w?.scanCooldownMs ?? defaultTenantWarehouse.scanCooldownMs,
    ),
  };
}

function mockErr400(msg: string) {
  const e = new Error(msg) as Error & { status: number };
  e.status = 400;
  return e;
}

/** For tests or manual reseed if needed later */
export function resetDevMockBackend() {
  state = createSeed();
}

export function mockListOrders(
  tenantId: string,
  opts?: { status?: OrderStatus; assignedTo?: string },
): Order[] {
  const s = ctx();
  let rows = s.orders.filter((o) => o.tenantId === tenantId);
  rows = [...rows].sort(
    (a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0),
  );
  if (opts?.status) rows = rows.filter((o) => o.status === opts.status);
  if (opts?.assignedTo) {
    rows = rows.filter((o) => o.assigned_to === opts.assignedTo);
  }
  return rows.slice(0, 200);
}

export function mockGetOrder(
  tenantId: string,
  orderId: string,
): Order | null {
  const o = ctx().orders.find((x) => x.id === orderId);
  if (!o || o.tenantId !== tenantId) return null;
  return o;
}

function findOrderIndex(orderId: string) {
  return ctx().orders.findIndex((o) => o.id === orderId);
}

export function mockAppendActivity(input: {
  tenantId: string;
  action: string;
  entityType: ActivityEntityType;
  entityId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}): ActivityLog {
  const s = ctx();
  const id = crypto.randomUUID();
  const timestamp = iso();
  const row: ActivityLog = {
    id,
    tenantId: input.tenantId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    userId: input.userId,
    metadata: input.metadata ?? {},
    timestamp,
  };
  s.activityLogs.push(row);
  return row;
}

export function mockListActivities(input: {
  tenantId: string;
  entityType: ActivityEntityType;
  entityId: string;
  limit: number;
}): ActivityLog[] {
  const s = ctx();
  return s.activityLogs
    .filter(
      (a) =>
        a.tenantId === input.tenantId &&
        a.entityType === input.entityType &&
        a.entityId === input.entityId,
    )
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, input.limit);
}

export function mockListShipmentsForOrder(
  tenantId: string,
  orderId: string,
): Shipment[] {
  return ctx().shipments.filter(
    (s) => s.tenantId === tenantId && s.order_id === orderId,
  );
}

export function mockListShipmentsForTenant(tenantId: string): Shipment[] {
  return ctx().shipments.filter((s) => s.tenantId === tenantId);
}

export function mockGetKanbanSettings(
  tenantId: string,
): TenantKanbanSettings | null {
  return ctx().tenantKanban[tenantId] ?? null;
}

export function mockSetKanbanSettings(
  tenantId: string,
  settings: TenantKanbanSettings,
) {
  ctx().tenantKanban[tenantId] = settings;
}

function actorName(tenantId: string, userId: string): string {
  const u = ctx().users.find((x) => x.id === userId && x.tenantId === tenantId);
  return u?.name ?? userId;
}

async function mockGetTenantAutomation(
  tenantId: string,
): Promise<TenantAutomationSettings> {
  const s = ctx();
  return { ...defaultTenantAutomation, ...(s.tenantAutomation[tenantId] ?? {}) };
}

async function mockMaybeAutoShipment(
  tenantId: string,
  orderId: string,
  prevStatus: OrderStatus,
  newStatus: OrderStatus,
  orderSnapshot: Order,
  actorUserId: string,
) {
  const automation = await mockGetTenantAutomation(tenantId);
  if (
    shouldAutoCreateShipment(prevStatus, newStatus, automation) &&
    orderNeedsDeliveryShipment(orderSnapshot)
  ) {
    await mockCreateShipmentForOrder({
      tenantId,
      orderId,
      type: "delivery",
      actorUserId,
    });
  }
}

async function mockTransition(
  tenantId: string,
  orderId: string,
  to: OrderStatus,
  actorUserId: string,
  extra?: Partial<Order>,
) {
  const s = ctx();
  const idx = findOrderIndex(orderId);
  if (idx < 0) throw new Error("Order not found");
  const order = s.orders[idx];
  if (order.tenantId !== tenantId) throw new Error("Order not found");
  assertTransition(order.status, to);
  const now = iso();
  const prevStatus = order.status;
  const next: Order = { ...order, ...extra, status: to, updatedAt: now };
  s.orders[idx] = next;
  mockAppendActivity({
    tenantId,
    action: `order.status.${to}`,
    entityType: "order",
    entityId: orderId,
    userId: actorUserId,
    metadata: { from: prevStatus },
  });
  await mockMaybeAutoShipment(
    tenantId,
    orderId,
    prevStatus,
    to,
    next,
    actorUserId,
  );
  return { prevStatus, order: next };
}

export async function mockUpsertOrderFromWooCommerce(input: {
  tenantId: string;
  wooOrderId: string;
  customer: Order["customer"];
  payment: Order["payment"];
  actorUserId: string;
  lineItems?: Order["lineItems"];
  shipping?: Order["shipping"];
  notes?: string;
  woocommerceOrderSnapshot?: unknown;
}): Promise<Order> {
  const s = ctx();
  const now = iso();
  const existingIdx = s.orders.findIndex(
    (o) =>
      o.tenantId === input.tenantId &&
      o.wooCommerceOrderId === input.wooOrderId,
  );
  if (existingIdx >= 0) {
    const prev = s.orders[existingIdx];
    const paymentLocked = prev.status !== "pending_confirmation";
    const snapUp =
      input.woocommerceOrderSnapshot != null
        ? (JSON.parse(
            JSON.stringify(input.woocommerceOrderSnapshot),
          ) as Order["woocommerceOrderSnapshot"])
        : prev.woocommerceOrderSnapshot;
    const next: Order = {
      ...prev,
      customer: input.customer,
      payment: paymentLocked ? prev.payment : input.payment,
      lineItems: input.lineItems ?? prev.lineItems,
      shipping: input.shipping ?? prev.shipping,
      notes: input.notes ?? prev.notes,
      woocommerceOrderSnapshot: snapUp,
      updatedAt: now,
    };
    s.orders[existingIdx] = next;
    mockAppendActivity({
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
        ? (JSON.parse(
            JSON.stringify(input.woocommerceOrderSnapshot),
          ) as Order["woocommerceOrderSnapshot"])
        : undefined,
    createdAt: now,
    updatedAt: now,
  };
  s.orders.push(order);
  mockAppendActivity({
    tenantId: input.tenantId,
    action: "order.created_webhook",
    entityType: "order",
    entityId: id,
    userId: input.actorUserId,
  });
  mockAnalyticsDailyIncrement({
    tenantId: order.tenantId,
    date: order.createdAt.slice(0, 10),
    deltas: {
      orders_count: 1,
      orders_value: order.payment.total_amount,
    },
  });
  return order;
}

export async function mockConfirmOrder(input: {
  tenantId: string;
  orderId: string;
  actorUserId: string;
}) {
  const { order } = await mockTransition(
    input.tenantId,
    input.orderId,
    "confirmed",
    input.actorUserId,
  );
  await mockIncrementUserStat({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    field: "confirmed",
  });
  const at = iso();
  mockAnalyticsDailyIncrement({
    tenantId: input.tenantId,
    date: at.slice(0, 10),
    deltas: { confirmed_orders_count: 1 },
  });
  return order;
}

export async function mockInvoiceOrder(input: {
  tenantId: string;
  orderId: string;
  invoiceNumber: string;
  actorUserId: string;
}) {
  const s = ctx();
  const idx = findOrderIndex(input.orderId);
  if (idx < 0) throw new Error("Order not found");
  let current = s.orders[idx];
  if (current.tenantId !== input.tenantId) throw new Error("Order not found");

  const invoice = { number: input.invoiceNumber, issuedAt: iso() };

  if (current.status === "confirmed") {
    assertTransition(current.status, "invoicing");
    const prevStatus = current.status;
    const now = iso();
    current = {
      ...current,
      status: "invoicing",
      invoice,
      updatedAt: now,
    };
    s.orders[idx] = current;
    mockAppendActivity({
      tenantId: input.tenantId,
      action: "order.status.invoicing",
      entityType: "order",
      entityId: input.orderId,
      userId: input.actorUserId,
      metadata: { from: prevStatus },
    });
    await mockMaybeAutoShipment(
      input.tenantId,
      input.orderId,
      prevStatus,
      "invoicing",
      current,
      input.actorUserId,
    );
  }

  if (current.status !== "invoicing") {
    throw new Error(`Cannot invoice from status ${current.status}`);
  }

  const { order: final } = await mockTransition(
    input.tenantId,
    input.orderId,
    "ready_for_warehouse",
    input.actorUserId,
    { invoice },
  );
  await mockIncrementUserStat({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    field: "invoiced",
  });
  return final;
}

export async function mockCancelOrder(input: {
  tenantId: string;
  orderId: string;
  actorUserId: string;
}) {
  const { order } = await mockTransition(
    input.tenantId,
    input.orderId,
    "cancelled",
    input.actorUserId,
  );
  return order;
}

export async function mockAssignOrder(input: {
  tenantId: string;
  orderId: string;
  assigneeUserId: string | null;
  actorUserId: string;
}) {
  const s = ctx();
  const idx = findOrderIndex(input.orderId);
  if (idx < 0) throw new Error("Order not found");
  const order = s.orders[idx];
  if (order.tenantId !== input.tenantId) throw new Error("Order not found");
  const now = iso();
  const next: Order = {
    ...order,
    assigned_to: input.assigneeUserId,
    updatedAt: now,
  };
  s.orders[idx] = next;
  mockAppendActivity({
    tenantId: input.tenantId,
    action: "order.assigned",
    entityType: "order",
    entityId: input.orderId,
    userId: input.actorUserId,
    metadata: { assigneeUserId: input.assigneeUserId },
  });
  return next;
}

export async function mockCreateShipmentForOrder(input: {
  tenantId: string;
  orderId: string;
  type?: ShipmentType;
  actorUserId: string;
}): Promise<Shipment> {
  const order = mockGetOrder(input.tenantId, input.orderId);
  if (!order) throw new Error("Order not found");
  const s = ctx();
  const id = crypto.randomUUID();
  const now = iso();
  const type: ShipmentType = input.type ?? "delivery";
  const awb = `MOCK-${id.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const byName = actorName(input.tenantId, input.actorUserId);
  const shipFee = order.shipping?.cost ?? 0;
  const shipment: Shipment = {
    id,
    tenantId: input.tenantId,
    order_id: input.orderId,
    awb,
    type,
    status: "created",
    provider: "mock",
    shipping_fees: shipFee,
    createdByUserId: input.actorUserId,
    createdByUserName: byName,
    createdAt: now,
    updatedAt: now,
  };
  const oidx = findOrderIndex(input.orderId);
  if (oidx < 0) throw new Error("Order not found");
  const o = s.orders[oidx];
  s.orders[oidx] = {
    ...o,
    shipmentIds: [...(o.shipmentIds ?? []), id],
    updatedAt: now,
  };
  s.shipments.push(shipment);
  mockAppendActivity({
    tenantId: input.tenantId,
    action: "shipment.created",
    entityType: "shipment",
    entityId: id,
    userId: input.actorUserId,
    metadata: { orderId: input.orderId, awb: shipment.awb },
  });
  if (type === "delivery") {
    mockAnalyticsDailyIncrement({
      tenantId: input.tenantId,
      date: now.slice(0, 10),
      deltas: { shipments_count: 1, shipping_cost: shipFee },
    });
  }
  return shipment;
}

export async function mockScanAwb(input: {
  tenantId: string;
  awb: string;
  actorUserId: string;
}): Promise<{ order: Order; shipment: Shipment }> {
  const wh = effectiveWarehouseForMock(input.tenantId);
  const mode = wh.singleScanFulfills ? "single_fulfill" : "per_step";
  const cooldownMs = wh.scanCooldownMs;
  const s = ctx();
  const shipIdx = s.shipments.findIndex(
    (sh) => sh.tenantId === input.tenantId && sh.awb === input.awb,
  );
  if (shipIdx < 0) throw new Error("Shipment not found for AWB");
  const shipment = s.shipments[shipIdx];
  const oidx = findOrderIndex(shipment.order_id);
  if (oidx < 0) throw new Error("Order not found");
  const order = s.orders[oidx];
  if (order.tenantId !== input.tenantId) throw new Error("Tenant mismatch");

  const now = iso();
  const prevOrderStatus = order.status;
  let newOrderStatus = order.status;
  let newShipmentStatus: ShipmentStatus = shipment.status;
  let packedAt = shipment.packedAt;
  let shippedAt = shipment.shippedAt;

  if (order.status === "shipped" && shipment.status === "shipped") {
    throw new Error("Duplicate scan: order already shipped for this AWB");
  } else if (order.status === "ready_for_warehouse") {
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
        throw mockErr400(
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

  const nextOrder: Order = {
    ...order,
    status: newOrderStatus,
    updatedAt: now,
  };
  const nextShip: Shipment = {
    ...shipment,
    status: newShipmentStatus,
    packedAt,
    shippedAt,
    updatedAt: now,
  };
  s.orders[oidx] = nextOrder;
  s.shipments[shipIdx] = nextShip;
  mockAppendActivity({
    tenantId: input.tenantId,
    action: "shipment.scan",
    entityType: "shipment",
    entityId: nextShip.id,
    userId: input.actorUserId,
    metadata: {
      awb: input.awb,
      orderStatus: nextOrder.status,
      scanMode: mode,
    },
  });

  const shouldIncPacked =
    nextOrder.status === "packed" ||
    (wh.singleScanFulfills &&
      prevOrderStatus === "ready_for_warehouse" &&
      nextOrder.status === "shipped");
  if (shouldIncPacked) {
    await mockIncrementUserStat({
      tenantId: input.tenantId,
      userId: input.actorUserId,
      field: "packed",
    });
  }

  return { order: nextOrder, shipment: nextShip };
}

export function mockListUsers(tenantId: string): User[] {
  return ctx().users.filter((u) => u.tenantId === tenantId);
}

export function mockGetTenant(tenantId: string): Tenant | null {
  return ctx().tenants[tenantId] ?? null;
}

export function mockCreateTenant(name: string): Tenant {
  const s = ctx();
  const id = crypto.randomUUID();
  const now = iso();
  const staffApiKey = `mock-${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
  const tenant: Tenant = {
    id,
    name: name.trim(),
    slug: `${slugify(name)}-${id.slice(0, 8)}`,
    ownerUserId: "",
    staffApiKey,
    createdAt: now,
    updatedAt: now,
  };
  s.tenants[id] = tenant;
  return tenant;
}

export function mockSetTenantOwner(tenantId: string, ownerUserId: string) {
  const s = ctx();
  const t = s.tenants[tenantId];
  if (!t) throw new Error("Tenant not found");
  t.ownerUserId = ownerUserId;
  t.updatedAt = iso();
}

export function mockGetUserByFirebaseUid(firebaseUid: string): User | null {
  return ctx().users.find((u) => u.firebaseUid === firebaseUid) ?? null;
}

export function mockCreateUser(input: {
  tenantId: string;
  name: string;
  email?: string;
  firebaseUid?: string;
  role: UserRole;
  permissions?: string[];
  daily_target?: number;
  actorUserId: string;
}): User {
  const s = ctx();
  const id = crypto.randomUUID();
  const now = iso();
  const user: User = {
    id,
    tenantId: input.tenantId,
    name: input.name,
    email: input.email,
    firebaseUid: input.firebaseUid,
    role: input.role,
    permissions: input.permissions ?? [],
    daily_target: input.daily_target ?? 0,
    createdAt: now,
    updatedAt: now,
  };
  s.users.push(user);
  mockAppendActivity({
    tenantId: input.tenantId,
    action: "user.created",
    entityType: "user",
    entityId: id,
    userId: input.actorUserId,
    metadata: { role: input.role },
  });
  return user;
}

export function mockGetUser(tenantId: string, userId: string): User | null {
  const u = ctx().users.find((x) => x.id === userId);
  if (!u || u.tenantId !== tenantId) return null;
  return u;
}

export function mockUpdateUser(input: {
  tenantId: string;
  targetUserId: string;
  name?: string;
  role?: UserRole;
  daily_target?: number;
  actorUserId: string;
}): User {
  const s = ctx();
  const idx = s.users.findIndex((u) => u.id === input.targetUserId);
  if (idx < 0) throw new Error("User not found");
  const prev = s.users[idx];
  if (prev.tenantId !== input.tenantId) throw new Error("User not found");
  const now = iso();
  const next: User = {
    ...prev,
    name: input.name ?? prev.name,
    role: input.role ?? prev.role,
    daily_target:
      input.daily_target !== undefined ? input.daily_target : prev.daily_target,
    updatedAt: now,
  };
  s.users[idx] = next;
  mockAppendActivity({
    tenantId: input.tenantId,
    action: "user.updated",
    entityType: "user",
    entityId: input.targetUserId,
    userId: input.actorUserId,
  });
  return next;
}

export function mockListTickets(
  tenantId: string,
  opts?: { status?: TicketStatus },
): Ticket[] {
  const s = ctx();
  let rows = s.tickets.filter((t) => t.tenantId === tenantId);
  rows = [...rows].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
  );
  if (opts?.status) rows = rows.filter((t) => t.status === opts.status);
  return rows.slice(0, 200);
}

export function mockCreateTicket(input: {
  tenantId: string;
  order_id: string;
  type: Ticket["type"];
  notes?: string;
  actorUserId: string;
}): Ticket {
  const s = ctx();
  const id = crypto.randomUUID();
  const now = iso();
  const ticket: Ticket = {
    id,
    tenantId: input.tenantId,
    order_id: input.order_id,
    type: input.type,
    status: "open",
    notes: input.notes,
    shipmentIds: [],
    createdAt: now,
    updatedAt: now,
  };
  s.tickets.push(ticket);
  mockAppendActivity({
    tenantId: input.tenantId,
    action: "ticket.created",
    entityType: "ticket",
    entityId: id,
    userId: input.actorUserId,
    metadata: { orderId: input.order_id, type: input.type },
  });
  const ord = mockGetOrder(input.tenantId, input.order_id);
  const orderVal = ord?.payment.total_amount ?? 0;
  const dkey = now.slice(0, 10);
  if (input.type === "return") {
    mockAnalyticsDailyIncrement({
      tenantId: input.tenantId,
      date: dkey,
      deltas: { returns_count: 1, returns_value: orderVal },
    });
  } else if (input.type === "exchange") {
    mockAnalyticsDailyIncrement({
      tenantId: input.tenantId,
      date: dkey,
      deltas: { exchanges_count: 1, exchanges_value: 0 },
    });
  }
  return ticket;
}

export function mockAssignTicket(input: {
  tenantId: string;
  ticketId: string;
  assigneeUserId: string | null;
  actorUserId: string;
}): Ticket {
  const s = ctx();
  const idx = s.tickets.findIndex((t) => t.id === input.ticketId);
  if (idx < 0) throw new Error("Ticket not found");
  const t = s.tickets[idx];
  if (t.tenantId !== input.tenantId) throw new Error("Ticket not found");
  const now = iso();
  const next: Ticket = {
    ...t,
    assigned_to: input.assigneeUserId,
    status: t.status === "open" ? "in_progress" : t.status,
    updatedAt: now,
  };
  s.tickets[idx] = next;
  mockAppendActivity({
    tenantId: input.tenantId,
    action: "ticket.assigned",
    entityType: "ticket",
    entityId: input.ticketId,
    userId: input.actorUserId,
    metadata: { assigneeUserId: input.assigneeUserId },
  });
  return next;
}

export async function mockResolveTicket(input: {
  tenantId: string;
  ticketId: string;
  createExchangeShipment?: boolean;
  actorUserId: string;
}): Promise<Ticket> {
  const s = ctx();
  const idx = s.tickets.findIndex((t) => t.id === input.ticketId);
  if (idx < 0) throw new Error("Ticket not found");
  const t = s.tickets[idx];
  if (t.tenantId !== input.tenantId) throw new Error("Ticket not found");

  const shipmentIds = [...(t.shipmentIds ?? [])];
  if (input.createExchangeShipment && t.type === "exchange") {
    const sh = await mockCreateShipmentForOrder({
      tenantId: input.tenantId,
      orderId: t.order_id,
      type: "exchange",
      actorUserId: input.actorUserId,
    });
    shipmentIds.push(sh.id);
  }

  const now = iso();
  const next: Ticket = {
    ...t,
    shipmentIds,
    status: "resolved",
    updatedAt: now,
  };
  s.tickets[idx] = next;
  mockAppendActivity({
    tenantId: input.tenantId,
    action: "ticket.resolved",
    entityType: "ticket",
    entityId: input.ticketId,
    userId: input.actorUserId,
    metadata: { createExchangeShipment: input.createExchangeShipment ?? false },
  });
  return next;
}

export function mockGetTenantAutomationStore(
  tenantId: string,
): TenantAutomationSettings {
  const s = ctx();
  return { ...defaultTenantAutomation, ...(s.tenantAutomation[tenantId] ?? {}) };
}

export function mockSetTenantAutomation(
  tenantId: string,
  automation: TenantAutomationSettings,
) {
  const s = ctx();
  s.tenantAutomation[tenantId] = automation;
}

export function mockGetTenantIntegrations(
  tenantId: string,
): TenantIntegrationsDoc {
  const s = ctx();
  return { ...(s.tenantIntegrations[tenantId] ?? {}) };
}

export function mockSetTenantWooCommerceWebhookSecret(
  tenantId: string,
  secret: string | null,
) {
  const s = ctx();
  const integrations: TenantIntegrationsDoc = {
    ...(s.tenantIntegrations[tenantId] ?? {}),
  };
  const woo = { ...(integrations.woocommerce ?? {}) };
  if (secret === null || secret.trim() === "") {
    delete woo.webhookSecret;
  } else {
    woo.webhookSecret = secret.trim();
  }
  if (Object.keys(woo).length === 0) {
    delete integrations.woocommerce;
  } else {
    integrations.woocommerce = woo;
  }
  if (Object.keys(integrations).length === 0) {
    delete s.tenantIntegrations[tenantId];
  } else {
    s.tenantIntegrations[tenantId] = integrations;
  }
}

export function mockSetTenantWooCommerceRestFields(
  tenantId: string,
  fields: {
    storeUrl?: string | null;
    consumerKey?: string | null;
    consumerSecret?: string | null;
  },
) {
  const s = ctx();
  const integrations: TenantIntegrationsDoc = {
    ...(s.tenantIntegrations[tenantId] ?? {}),
  };
  const woo = { ...(integrations.woocommerce ?? {}) };
  const apply = (
    key: "storeUrl" | "consumerKey" | "consumerSecret",
    val: string | null | undefined,
  ) => {
    if (val === undefined) return;
    if (val === null || val.trim() === "") {
      delete woo[key];
    } else {
      woo[key] = val.trim();
    }
  };
  apply("storeUrl", fields.storeUrl);
  apply("consumerKey", fields.consumerKey);
  apply("consumerSecret", fields.consumerSecret);
  if (Object.keys(woo).length === 0) {
    delete integrations.woocommerce;
  } else {
    integrations.woocommerce = woo;
  }
  if (Object.keys(integrations).length === 0) {
    delete s.tenantIntegrations[tenantId];
  } else {
    s.tenantIntegrations[tenantId] = integrations;
  }
}

export function mockSetTenantBostaFields(
  tenantId: string,
  fields: {
    apiKey?: string | null;
    baseUrl?: string | null;
    defaultCityId?: string | null;
    defaultZoneId?: string | null;
    defaultBuildingNumber?: string | null;
    defaultAddressLine?: string | null;
    packageDescription?: string | null;
  },
) {
  const s = ctx();
  const integrations: TenantIntegrationsDoc = {
    ...(s.tenantIntegrations[tenantId] ?? {}),
  };
  const bosta = { ...(integrations.bosta ?? {}) };
  const apply = (key: keyof typeof bosta, val: string | null | undefined) => {
    if (val === undefined) return;
    if (val === null || val.trim() === "") {
      delete bosta[key];
    } else {
      (bosta as Record<string, string>)[key as string] = val.trim();
    }
  };
  apply("apiKey", fields.apiKey);
  apply("baseUrl", fields.baseUrl);
  apply("defaultCityId", fields.defaultCityId);
  apply("defaultZoneId", fields.defaultZoneId);
  apply("defaultBuildingNumber", fields.defaultBuildingNumber);
  apply("defaultAddressLine", fields.defaultAddressLine);
  apply("packageDescription", fields.packageDescription);
  if (Object.keys(bosta).length === 0) {
    delete integrations.bosta;
  } else {
    integrations.bosta = bosta;
  }
  if (Object.keys(integrations).length === 0) {
    delete s.tenantIntegrations[tenantId];
  } else {
    s.tenantIntegrations[tenantId] = integrations;
  }
}

export function mockRevertOrder(input: {
  tenantId: string;
  orderId: string;
  to: "invoicing" | "ready_for_warehouse";
  reason: string;
  actorUserId: string;
}): Order {
  const s = ctx();
  const oidx = findOrderIndex(input.orderId);
  if (oidx < 0) throw new Error("Order not found");
  const order = s.orders[oidx];
  if (order.tenantId !== input.tenantId) throw new Error("Order not found");
  assertWarehouseRevert(order.status, input.to);
  const from = order.status;
  const now = iso();
  const next: Order = { ...order, status: input.to, updatedAt: now };
  s.orders[oidx] = next;
  if (from === "packed" && input.to === "ready_for_warehouse") {
    for (let i = 0; i < s.shipments.length; i++) {
      const sh = s.shipments[i];
      if (
        sh.order_id === input.orderId &&
        sh.tenantId === input.tenantId &&
        sh.type === "delivery"
      ) {
        s.shipments[i] = {
          ...sh,
          status: "created",
          packedAt: undefined,
          shippedAt: undefined,
          updatedAt: now,
        };
        break;
      }
    }
  }
  mockAppendActivity({
    tenantId: input.tenantId,
    action: "order.revert",
    entityType: "order",
    entityId: input.orderId,
    userId: input.actorUserId,
    metadata: {
      from,
      to: next.status,
      reason: input.reason.trim().slice(0, 2000),
    },
  });
  return next;
}

export function mockSetTenantWarehouse(
  tenantId: string,
  fields: { singleScanFulfills?: boolean; scanCooldownMs?: number | null },
) {
  const s = ctx();
  const integrations: TenantIntegrationsDoc = {
    ...(s.tenantIntegrations[tenantId] ?? {}),
  };
  const prev: TenantWarehouseSettings = { ...(integrations.warehouse ?? {}) };
  if (fields.singleScanFulfills !== undefined) {
    if (fields.singleScanFulfills) prev.singleScanFulfills = true;
    else delete prev.singleScanFulfills;
  }
  if (fields.scanCooldownMs !== undefined) {
    if (fields.scanCooldownMs === null) delete prev.scanCooldownMs;
    else prev.scanCooldownMs = fields.scanCooldownMs;
  }
  if (Object.keys(prev).length === 0) {
    delete integrations.warehouse;
  } else {
    integrations.warehouse = prev;
  }
  if (Object.keys(integrations).length === 0) {
    delete s.tenantIntegrations[tenantId];
  } else {
    s.tenantIntegrations[tenantId] = integrations;
  }
}

export function mockGetUserStatsForToday(
  tenantId: string,
  userId: string,
): UserStats | null {
  const date = new Date().toISOString().slice(0, 10);
  const id = `${tenantId}_${userId}_${date}`;
  const s = ctx();
  const existing = s.userStats[id];
  if (existing) return { ...existing };
  return {
    id,
    tenantId,
    userId,
    date,
    confirmed: 0,
    invoiced: 0,
    packed: 0,
    updatedAt: iso(),
  };
}

export function mockIncrementUserStat(input: {
  tenantId: string;
  userId: string;
  field: "confirmed" | "invoiced" | "packed";
}) {
  const date = new Date().toISOString().slice(0, 10);
  const id = `${input.tenantId}_${input.userId}_${date}`;
  const s = ctx();
  const prev =
    s.userStats[id] ??
    ({
      id,
      tenantId: input.tenantId,
      userId: input.userId,
      date,
      confirmed: 0,
      invoiced: 0,
      packed: 0,
      updatedAt: iso(),
    } satisfies UserStats);
  s.userStats[id] = {
    ...prev,
    [input.field]: (prev[input.field] ?? 0) + 1,
    updatedAt: iso(),
  };
}

function emptyAnalyticsDailyRow(tenantId: string, date: string): AnalyticsDaily {
  const id = `${tenantId}_${date}`;
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
    updatedAt: iso(),
  };
}

export function mockAnalyticsDailyIncrement(input: {
  tenantId: string;
  date: string;
  deltas: Partial<{
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
}) {
  const s = ctx();
  const id = `${input.tenantId}_${input.date}`;
  const base =
    s.analyticsDaily[id] ?? emptyAnalyticsDailyRow(input.tenantId, input.date);
  const next: AnalyticsDaily = { ...base };
  const d = input.deltas;
  if (d.orders_count) next.orders_count += d.orders_count;
  if (d.orders_value) next.orders_value += d.orders_value;
  if (d.confirmed_orders_count) {
    next.confirmed_orders_count += d.confirmed_orders_count;
  }
  if (d.shipments_count) next.shipments_count += d.shipments_count;
  if (d.shipping_cost) next.shipping_cost += d.shipping_cost;
  if (d.returns_count) next.returns_count += d.returns_count;
  if (d.returns_value) next.returns_value += d.returns_value;
  if (d.exchanges_count) next.exchanges_count += d.exchanges_count;
  if (d.exchanges_value) next.exchanges_value += d.exchanges_value;
  next.updatedAt = iso();
  s.analyticsDaily[id] = next;
}

export function mockGetAnalyticsDailyDoc(
  tenantId: string,
  date: string,
): AnalyticsDaily {
  const s = ctx();
  const id = `${tenantId}_${date}`;
  return s.analyticsDaily[id] ?? emptyAnalyticsDailyRow(tenantId, date);
}

/** Recompute one UTC day from in-memory orders/shipments/tickets (reconciliation in mock mode). */
export function mockRebuildAnalyticsDay(
  tenantId: string,
  date: string,
): AnalyticsDaily {
  const s = ctx();
  const orders = s.orders.filter((o) => o.tenantId === tenantId);
  const orderById = new Map(orders.map((o) => [o.id, o]));

  let orders_count = 0;
  let orders_value = 0;
  for (const o of orders) {
    if (o.createdAt.slice(0, 10) !== date) continue;
    orders_count += 1;
    orders_value += o.payment.total_amount;
  }

  let confirmed_orders_count = 0;
  for (const a of s.activityLogs) {
    if (a.tenantId !== tenantId) continue;
    if (a.action !== "order.status.confirmed") continue;
    if (a.timestamp.slice(0, 10) !== date) continue;
    confirmed_orders_count += 1;
  }

  let shipments_count = 0;
  let shipping_cost = 0;
  for (const sh of s.shipments) {
    if (sh.tenantId !== tenantId) continue;
    if (sh.type !== "delivery" || sh.createdAt.slice(0, 10) !== date) continue;
    shipments_count += 1;
    const o = orderById.get(sh.order_id);
    shipping_cost += sh.shipping_fees ?? o?.shipping?.cost ?? 0;
  }

  let returns_count = 0;
  let returns_value = 0;
  let exchanges_count = 0;
  for (const t of s.tickets) {
    if (t.tenantId !== tenantId) continue;
    if (t.createdAt.slice(0, 10) !== date) continue;
    if (t.type === "return") {
      returns_count += 1;
      returns_value += orderById.get(t.order_id)?.payment.total_amount ?? 0;
    } else if (t.type === "exchange") {
      exchanges_count += 1;
    }
  }

  const id = `${tenantId}_${date}`;
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
    exchanges_value: 0,
    updatedAt: iso(),
  };
  s.analyticsDaily[id] = row;
  return row;
}

export function mockClaimIntegrationEvent(input: {
  tenantId: string;
  source: string;
  deliveryId: string;
  payloadSummary?: Record<string, unknown>;
}): "new" | "duplicate" {
  const key = `${input.tenantId}_${input.source}_${input.deliveryId}`;
  const s = ctx();
  if (s.integrationKeys.has(key)) return "duplicate";
  s.integrationKeys.add(key);
  return "new";
}

export function mockReleaseIntegrationEventClaim(input: {
  tenantId: string;
  source: string;
  deliveryId: string;
}): void {
  const key = `${input.tenantId}_${input.source}_${input.deliveryId}`;
  ctx().integrationKeys.delete(key);
}

export function mockAppendWebhookIngestLog(row: WebhookIngestLog): void {
  const s = ctx();
  s.webhookIngestLogs.unshift(row);
  if (s.webhookIngestLogs.length > 500) s.webhookIngestLogs.length = 500;
}

export function mockListWebhookIngestLogs(
  tenantId: string,
  limit: number,
): WebhookIngestLog[] {
  return ctx()
    .webhookIngestLogs.filter((r) => r.tenantId === tenantId)
    .slice(0, limit);
}
