/**
 * In-memory backend for developer mock mode.
 * Keeps behavior close to Firestore services without external DB.
 */
import { buildPayment } from "@/lib/logic/payment";
import { orderIngestFingerprint } from "@/lib/logic/order-ingest-fingerprint";
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
  type OutboundWebhookDeliveryLog,
  type Order,
  type OrderStatus,
  type Shipment,
  type ShipmentStatus,
  type ShipmentType,
  type Ticket,
  type TicketResolutionKind,
  type TicketStatus,
  type User,
  type UserRole,
  type UserStats,
  type TenantAutomationSettings,
  type TenantIntegrationsDoc,
  type TenantKanbanSettings,
  type AnalyticsDaily,
  type PlatformPackage,
  type Tenant,
  type TenantEntitlements,
  type TenantStatus,
  type TenantWarehouseSettings,
  type WebhookIngestLog,
  type OrderEvent,
} from "@/lib/types/models";
import { slugify } from "@/lib/string/slugify";
import { resetMockChatBackend } from "@/lib/dev/mock-chat-backend";

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
  orderEvents: OrderEvent[];
  outboundWebhookLogs: OutboundWebhookDeliveryLog[];
  integrationKeys: Set<string>;
  tenants: Record<string, Tenant>;
  platformPackages: Record<string, PlatformPackage>;
  tenantEntitlements: Record<string, TenantEntitlements>;
};

let state: MockState | null = null;

function iso() {
  return new Date().toISOString();
}

function mockOrderCogsValue(order: Pick<Order, "lineItems">): number {
  return (order.lineItems ?? []).reduce((sum, item) => {
    const lineCost =
      typeof item.line_cost === "number" && Number.isFinite(item.line_cost)
        ? item.line_cost
        : undefined;
    const unitCost =
      typeof item.unit_cost === "number" && Number.isFinite(item.unit_cost)
        ? item.unit_cost
        : undefined;
    return sum + Math.max(0, lineCost ?? (unitCost ?? 0) * item.quantity);
  }, 0);
}

function mockShipmentAnalyticsDeltas(
  type: ShipmentType,
  shippingCost: number,
): Partial<AnalyticsDaily> {
  const base: Partial<AnalyticsDaily> = {
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

function createSeed(): MockState {
  resetMockChatBackend();
  const t0 = "2026-04-20T10:00:00.000Z";
  const users: User[] = [
    {
      id: "user-admin-1",
      tenantId: DEMO_TENANT,
      name: "مدير النظام",
      email: "admin@Store.local",
      language: "en",
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
      language: "en",
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
      language: "en",
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
      status: "invoiced",
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
      status: "awb_created",
      invoice: { number: "INV-1043", issuedAt: "2026-04-24T11:00:00.000Z" },
      shipmentIds: ["ship-demo-001"],
      latestShipmentAwb: "MOCK-DEMO-001",
      latestShipmentStatus: "created",
      latestShipmentCarrierTrackingStatus: "created",
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
      status: "warehouse_packed",
      invoice: { number: "INV-1044", issuedAt: "2026-04-24T11:30:00.000Z" },
      shipmentIds: ["ship-demo-002"],
      latestShipmentAwb: "MOCK-DEMO-002",
      latestShipmentStatus: "packed",
      latestShipmentCarrierTrackingStatus: "created",
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
      status: "out_for_shipping",
      invoice: { number: "INV-1045", issuedAt: "2026-04-24T13:00:00.000Z" },
      shipmentIds: ["ship-demo-003"],
      latestShipmentAwb: "MOCK-DEMO-003",
      latestShipmentStatus: "shipped",
      latestShipmentCarrierTrackingStatus: "in_transit",
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
    status: "active",
    staffApiKey: "demo-staff-api-key-mock-only",
    createdAt: t0,
    updatedAt: t0,
  };

  const starterPackage: PlatformPackage = {
    id: "pkg-starter",
    name: "Starter",
    description: "Default mock package for local platform testing.",
    active: true,
    limits: { maxUsers: 10, maxOrdersPerMonth: 500 },
    features: {
      woocommerce: true,
      bosta: true,
      jntEgypt: true,
      fedex: true,
      storefrontOrders: true,
      outboundWebhooks: false,
      whatsapp: true,
    },
    supportTier: "standard",
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
    orderEvents: [],
    outboundWebhookLogs: [],
    integrationKeys: new Set(),
    tenants: { [DEMO_TENANT]: demoTenant },
    platformPackages: { [starterPackage.id]: starterPackage },
    tenantEntitlements: {
      [DEMO_TENANT]: {
        tenantId: DEMO_TENANT,
        packageId: starterPackage.id,
        packageSnapshot: starterPackage,
        assignedAt: t0,
        assignedBy: "mock-seed",
        updatedAt: t0,
      },
    },
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
  opts?: { status?: OrderStatus; assignedTo?: string; from?: string; to?: string },
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
  if (opts?.from) {
    const fromTime = new Date(`${opts.from}T00:00:00.000Z`).getTime();
    rows = rows.filter((o) => new Date(o.createdAt).getTime() >= fromTime);
  }
  if (opts?.to) {
    const toTime = new Date(`${opts.to}T23:59:59.999Z`).getTime();
    rows = rows.filter((o) => new Date(o.createdAt).getTime() <= toTime);
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

export function mockListShipmentsForTenant(
  tenantId: string,
  opts?: { from?: string; to?: string },
): Shipment[] {
  let rows = ctx().shipments.filter((s) => s.tenantId === tenantId);
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

export async function mockTransition(
  tenantId: string,
  orderId: string,
  to: OrderStatus,
  actorUserId: string,
  extra?: Partial<Order>,
  activityMetadata?: Record<string, unknown>,
) {
  const s = ctx();
  const idx = findOrderIndex(orderId);
  if (idx < 0) throw new Error("Order not found");
  const order = s.orders[idx];
  if (order.tenantId !== tenantId) throw new Error("Order not found");
  assertTransition(order.status, to);
  const now = iso();
  const prevStatus = order.status;
  const next: Order = {
    ...order,
    ...extra,
    status: to,
    statusUpdatedAt: now,
    updatedAt: now,
  };
  s.orders[idx] = next;
  mockAppendActivity({
    tenantId,
    action: `order.status.${to}`,
    entityType: "order",
    entityId: orderId,
    userId: actorUserId,
    metadata: { from: prevStatus, to, ...(activityMetadata ?? {}) },
  });
  mockAppendOrderEvent({
    tenantId,
    orderId,
    action: `order.status.${to}`,
    userId: actorUserId,
    metadata: { from: prevStatus, to, ...(activityMetadata ?? {}) },
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
  deliveryId?: string;
}): Promise<{
  order: Order;
  outcome: "created" | "updated" | "unchanged";
}> {
  const s = ctx();
  const now = iso();
  const fingerprint = orderIngestFingerprint({
    customer: input.customer,
    payment: input.payment,
    lineItems: input.lineItems,
    shipping: input.shipping,
    notes: input.notes,
  });
  const lineItemCount = input.lineItems?.length ?? 0;
  const existingIdx = s.orders.findIndex(
    (o) =>
      o.tenantId === input.tenantId &&
      (o.wooCommerceOrderId === input.wooOrderId ||
        o.externalOrderId === input.wooOrderId),
  );
  if (existingIdx >= 0) {
    const prev = s.orders[existingIdx];
    if (prev.lastWebhookSyncFingerprint === fingerprint) {
      const bumped: Order = {
        ...prev,
        lastSyncedAt: now,
        updatedAt: now,
      };
      s.orders[existingIdx] = bumped;
      return { order: bumped, outcome: "unchanged" };
    }
    const paymentLocked = prev.status !== "pending_confirmation";
    const next: Order = {
      ...prev,
      customer: input.customer,
      payment: paymentLocked ? prev.payment : input.payment,
      lineItems: input.lineItems ?? prev.lineItems,
      shipping: input.shipping ?? prev.shipping,
      notes: input.notes ?? prev.notes,
      lineItemCount,
      externalOrderId: input.wooOrderId,
      source: "woocommerce",
      lastSyncedAt: now,
      lastWebhookSyncFingerprint: fingerprint,
      updatedAt: now,
      woocommerceOrderSnapshot: undefined,
      webhookPayloadRef: undefined,
    };
    s.orders[existingIdx] = next;
    mockAppendActivity({
      tenantId: input.tenantId,
      action: "order.upsert_webhook",
      entityType: "order",
      entityId: prev.id,
      userId: input.actorUserId,
      metadata: { deliveryId: input.deliveryId, fingerprint },
    });
    mockAppendOrderEvent({
      tenantId: input.tenantId,
      orderId: prev.id,
      action: "order.ingest.updated",
      userId: input.actorUserId,
      metadata: {
        deliveryId: input.deliveryId,
        fingerprint,
        wooOrderId: input.wooOrderId,
      },
    });
    return { order: next, outcome: "updated" };
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
    externalOrderId: input.wooOrderId,
    source: "woocommerce",
    lastSyncedAt: now,
    lineItemCount,
    lineItems: input.lineItems,
    shipping: input.shipping,
    notes: input.notes,
    lastWebhookSyncFingerprint: fingerprint,
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
    metadata: { deliveryId: input.deliveryId, fingerprint },
  });
  mockAppendOrderEvent({
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
  mockAnalyticsDailyIncrement({
    tenantId: order.tenantId,
    date: order.createdAt.slice(0, 10),
    deltas: {
      orders_count: 1,
      orders_value: order.payment.total_amount,
      cogs_value: mockOrderCogsValue(order),
    },
  });
  return { order, outcome: "created" };
}

export async function mockConfirmOrder(input: {
  tenantId: string;
  orderId: string;
  actorUserId: string;
  paidAmount?: number;
}) {
  const s = ctx();
  const idx = findOrderIndex(input.orderId);
  if (idx < 0) throw new Error("Order not found");
  const current = s.orders[idx];
  if (current.tenantId !== input.tenantId) throw new Error("Order not found");
  let extra: Partial<Order> | undefined;
  if (current.payment.payment_status === "partial") {
    if (input.paidAmount === undefined) {
      throw new Error("Paid amount is required for partial orders");
    }
    if (!Number.isFinite(input.paidAmount)) {
      throw new Error("Paid amount must be a valid number");
    }
    if (input.paidAmount < 0) {
      throw new Error("Paid amount cannot be negative");
    }
    if (input.paidAmount > current.payment.total_amount) {
      throw new Error("Paid amount cannot exceed order total");
    }
    extra = {
      payment: buildPayment({
        payment_status: "partial",
        total_amount: current.payment.total_amount,
        paid_amount: input.paidAmount,
      }),
    };
  }
  const { order } = await mockTransition(
    input.tenantId,
    input.orderId,
    "confirmed",
    input.actorUserId,
    extra,
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

  // confirmed → invoice_required → invoiced (مماثل لخدمة الإنتاج)
  if (current.status === "confirmed") {
    const reqResult = await mockTransition(
      input.tenantId,
      input.orderId,
      "invoice_required",
      input.actorUserId,
    );
    current = reqResult.order;
  }

  if (current.status !== "invoice_required") {
    throw new Error(`Cannot invoice from status ${current.status}`);
  }

  const { order: final } = await mockTransition(
    input.tenantId,
    input.orderId,
    "invoiced",
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
  reason: string;
}) {
  const { order } = await mockTransition(
    input.tenantId,
    input.orderId,
    "cancelled",
    input.actorUserId,
    {
      cancelReason: input.reason,
      cancelledAt: iso(),
      cancelledByUserId: input.actorUserId,
    },
    { reason: input.reason },
  );
  return order;
}

export function mockDeleteOrder(input: {
  tenantId: string;
  orderId: string;
  actorUserId: string;
}): {
  orderId: string;
  deletedShipmentIds: string[];
  deletedTicketIds: string[];
} {
  const s = ctx();
  const idx = findOrderIndex(input.orderId);
  if (idx < 0) throw new Error("Order not found");
  const order = s.orders[idx];
  if (order.tenantId !== input.tenantId) throw new Error("Order not found");

  const deletedShipmentIds = s.shipments
    .filter((sh) => sh.tenantId === input.tenantId && sh.order_id === input.orderId)
    .map((sh) => sh.id);
  const deletedTicketIds = s.tickets
    .filter((t) => t.tenantId === input.tenantId && t.order_id === input.orderId)
    .map((t) => t.id);

  s.shipments = s.shipments.filter(
    (sh) => !(sh.tenantId === input.tenantId && sh.order_id === input.orderId),
  );
  s.tickets = s.tickets.filter(
    (t) => !(t.tenantId === input.tenantId && t.order_id === input.orderId),
  );
  s.orders.splice(idx, 1);

  mockAppendActivity({
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
  mockAnalyticsDailyIncrement({
    tenantId: input.tenantId,
    date: order.createdAt.slice(0, 10),
    deltas: {
      orders_count: -1,
      orders_value: -order.payment.total_amount,
      cogs_value: -mockOrderCogsValue(order),
    },
  });

  return {
    orderId: input.orderId,
    deletedShipmentIds,
    deletedTicketIds,
  };
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
  provider?: Shipment["provider"];
  serviceCode?: string;
  labelFormat?: Shipment["labelFormat"];
  actorUserId: string;
}): Promise<Shipment> {
  const order = mockGetOrder(input.tenantId, input.orderId);
  if (!order) throw new Error("Order not found");
  const s = ctx();
  const id = crypto.randomUUID();
  const now = iso();
  const type: ShipmentType = input.type ?? "delivery";
  const provider = input.provider ?? "mock";
  const providerPrefix =
    provider === "jnt_egypt" ? "JTE" : provider === "fedex" ? "FDX" : "MOCK";
  const awb = `${providerPrefix}-${id.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const byName = actorName(input.tenantId, input.actorUserId);
  const shipFee = order.shipping?.cost ?? 0;
  const shipment: Shipment = {
    id,
    tenantId: input.tenantId,
    order_id: input.orderId,
    awb,
    type,
    status: "created",
    provider,
    serviceCode: input.serviceCode,
    labelFormat: input.labelFormat ?? "pdf",
    labelUrl:
      input.labelFormat === "zpl" || input.labelFormat === "thermal"
        ? undefined
        : `https://example.test/labels/${id}.pdf`,
    thermalLabelData:
      input.labelFormat === "zpl" || input.labelFormat === "thermal"
        ? "^XA^FO40,40^FDDEMO LABEL^FS^XZ"
        : undefined,
    cod_amount: order.payment.cod_amount,
    allow_opening: false,
    shipping_fees: shipFee,
    createdByUserId: input.actorUserId,
    createdByUserName: byName,
    carrierTrackingStatus: "created",
    trackingHistory: [{ at: now, status: "created" }],
    createdAt: now,
    updatedAt: now,
  };
  const oidx = findOrderIndex(input.orderId);
  if (oidx < 0) throw new Error("Order not found");
  const o = s.orders[oidx];
  s.orders[oidx] = {
    ...o,
    shipmentIds: [...(o.shipmentIds ?? []), id],
    latestShipmentAwb: shipment.awb,
    latestShipmentStatus: shipment.status,
    latestShipmentCarrierTrackingStatus: shipment.carrierTrackingStatus,
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
  mockAnalyticsDailyIncrement({
    tenantId: input.tenantId,
    date: now.slice(0, 10),
    deltas: mockShipmentAnalyticsDeltas(type, shipFee),
  });
  return shipment;
}

export function mockUpdateShipment(input: {
  tenantId: string;
  shipmentId: string;
  actorUserId: string;
  codAmount?: number;
  allowOpening?: boolean;
  notes?: string;
}): Shipment {
  const s = ctx();
  const idx = s.shipments.findIndex((sh) => sh.id === input.shipmentId);
  if (idx < 0) throw new Error("Shipment not found");
  const shipment = s.shipments[idx];
  if (shipment.tenantId !== input.tenantId) throw new Error("Shipment not found");
  if (shipment.status === "cancelled") throw new Error("لا يمكن تعديل بوليصة ملغاة.");
  if (shipment.status === "shipped" || shipment.status === "delivered") {
    throw new Error("لا يمكن تعديل هذه البوليصة بعد تسليمها للمندوب.");
  }
  const now = iso();
  const next: Shipment = {
    ...shipment,
    cod_amount: input.codAmount ?? shipment.cod_amount,
    allow_opening: input.allowOpening ?? shipment.allow_opening,
    carrierTrackingStatus: "updated",
    lastTrackingSyncAt: now,
    trackingHistory: [
      ...(shipment.trackingHistory ?? []),
      { at: now, status: "updated", details: "Demo shipment updated" },
    ].slice(-25),
    updatedAt: now,
  };
  s.shipments[idx] = next;

  if (input.codAmount !== undefined && shipment.type === "delivery") {
    const oidx = findOrderIndex(shipment.order_id);
    if (oidx >= 0) {
      const order = s.orders[oidx];
      const total = Math.round(order.payment.total_amount * 100) / 100;
      const cod = Math.round(Math.max(0, input.codAmount) * 100) / 100;
      const paid = Math.round(Math.max(0, total - cod) * 100) / 100;
      s.orders[oidx] = {
        ...order,
        payment: {
          payment_status: cod <= 0 ? "paid" : cod >= total ? "cod" : "partial",
          total_amount: total,
          paid_amount: paid,
          remaining_amount: cod,
          cod_amount: cod,
        },
        latestShipmentAwb: next.awb,
        latestShipmentStatus: next.status,
        latestShipmentCarrierTrackingStatus: next.carrierTrackingStatus,
        updatedAt: now,
      };
    }
  }

  mockAppendActivity({
    tenantId: input.tenantId,
    action: "shipment.updated",
    entityType: "shipment",
    entityId: input.shipmentId,
    userId: input.actorUserId,
    metadata: {
      awb: shipment.awb,
      codAmount: input.codAmount,
      allowOpening: input.allowOpening,
      notes: input.notes,
    },
  });
  return next;
}

export function mockSyncShipmentTracking(input: {
  tenantId: string;
  shipmentId: string;
  actorUserId: string;
}): Shipment {
  const s = ctx();
  const idx = s.shipments.findIndex((sh) => sh.id === input.shipmentId);
  if (idx < 0) throw new Error("Shipment not found");
  const shipment = s.shipments[idx];
  if (shipment.tenantId !== input.tenantId) throw new Error("Shipment not found");
  const now = iso();
  const carrierTrackingStatus =
    shipment.status === "cancelled" ? "cancelled" : "mock_in_transit";
  const next: Shipment = {
    ...shipment,
    carrierTrackingStatus,
    lastTrackingSyncAt: now,
    trackingHistory: [
      ...(shipment.trackingHistory ?? []),
      { at: now, status: carrierTrackingStatus, details: "Demo tracking update" },
    ].slice(-25),
    updatedAt: now,
  };
  s.shipments[idx] = next;
  mockAppendActivity({
    tenantId: input.tenantId,
    action: "shipment.tracking_synced",
    entityType: "shipment",
    entityId: input.shipmentId,
    userId: input.actorUserId,
    metadata: { awb: shipment.awb, carrierTrackingStatus },
  });
  return next;
}

export function mockCancelShipment(input: {
  tenantId: string;
  shipmentId: string;
  actorUserId: string;
}): Shipment {
  const s = ctx();
  const idx = s.shipments.findIndex((sh) => sh.id === input.shipmentId);
  if (idx < 0) throw new Error("Shipment not found");
  const shipment = s.shipments[idx];
  if (shipment.tenantId !== input.tenantId) throw new Error("Shipment not found");
  const now = iso();
  const next: Shipment = {
    ...shipment,
    status: "cancelled",
    carrierTrackingStatus: "cancelled",
    lastTrackingSyncAt: now,
    cancelledAt: now,
    cancelledByUserId: input.actorUserId,
    trackingHistory: [
      ...(shipment.trackingHistory ?? []),
      { at: now, status: "cancelled", details: "Demo shipment cancelled" },
    ].slice(-25),
    updatedAt: now,
  };
  s.shipments[idx] = next;
  mockAppendActivity({
    tenantId: input.tenantId,
    action: "shipment.cancelled",
    entityType: "shipment",
    entityId: input.shipmentId,
    userId: input.actorUserId,
    metadata: { awb: shipment.awb, carrierTrackingStatus: "cancelled" },
  });
  return next;
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

  if (order.status === "out_for_shipping" && shipment.status === "shipped") {
    throw new Error("Duplicate scan: order already shipped for this AWB");
  } else if (order.status === "awb_created") {
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
        throw mockErr400(
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
    nextOrder.status === "warehouse_packed" ||
    (wh.singleScanFulfills &&
      prevOrderStatus === "awb_created" &&
      nextOrder.status === "out_for_shipping");
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

export function mockGetTenantBySlug(slug: string): Tenant | null {
  const normalizedSlug = slugify(slug);
  return (
    Object.values(ctx().tenants).find((tenant) => tenant.slug === normalizedSlug) ??
    null
  );
}

export function mockListTenants(): Tenant[] {
  return Object.values(ctx().tenants).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );
}

export function mockCreateTenant(name: string): Tenant {
  const s = ctx();
  const slug = slugify(name);
  if (mockGetTenantBySlug(slug)) {
    const e = new Error("Company name is already registered") as Error & {
      status: number;
    };
    e.status = 409;
    throw e;
  }
  const id = crypto.randomUUID();
  const now = iso();
  const staffApiKey = `mock-${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
  const tenant: Tenant = {
    id,
    name: name.trim(),
    slug,
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

export function mockSetTenantStatus(input: {
  tenantId: string;
  status: TenantStatus;
  reason?: string | null;
}): Tenant {
  const s = ctx();
  const t = s.tenants[input.tenantId];
  if (!t) throw new Error("Tenant not found");
  const now = iso();
  const next: Tenant = {
    ...t,
    status: input.status,
    suspendedAt: input.status === "suspended" ? now : undefined,
    suspendedReason:
      input.status === "suspended" ? input.reason?.trim() || undefined : undefined,
    updatedAt: now,
  };
  s.tenants[input.tenantId] = next;
  return next;
}

export function mockGetUserBySupabaseUserId(supabaseUserId: string): User | null {
  return ctx().users.find((u) => u.supabaseUserId === supabaseUserId) ?? null;
}

export function mockCreateUser(input: {
  tenantId: string;
  name: string;
  email?: string;
  supabaseUserId?: string;
  language?: User["language"];
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
    supabaseUserId: input.supabaseUserId,
    language: input.language ?? "en",
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
  language?: User["language"];
  role?: UserRole;
  permissions?: string[];
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
    language: input.language ?? prev.language ?? "en",
    role: input.role ?? prev.role,
    permissions:
      input.permissions !== undefined ? input.permissions : prev.permissions,
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

export function mockListTicketsByOrder(
  tenantId: string,
  orderId: string,
): Ticket[] {
  return mockListTickets(tenantId).filter((t) => t.order_id === orderId);
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
  const firstNote = input.notes?.trim()
    ? {
        id: crypto.randomUUID(),
        body: input.notes.trim(),
        userId: input.actorUserId,
        createdAt: now,
      }
    : undefined;
  const ticket: Ticket = {
    id,
    tenantId: input.tenantId,
    order_id: input.order_id,
    type: input.type,
    status: "open",
    notes: firstNote?.body,
    notesHistory: firstNote ? [firstNote] : [],
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
  const dkey = now.slice(0, 10);
  if (input.type === "return") {
    mockAnalyticsDailyIncrement({
      tenantId: input.tenantId,
      date: dkey,
      deltas: { returns_count: 1 },
    });
  } else if (input.type === "exchange") {
    mockAnalyticsDailyIncrement({
      tenantId: input.tenantId,
      date: dkey,
      deltas: { exchanges_count: 1 },
    });
  }
  return ticket;
}

export function mockGetTicket(
  tenantId: string,
  ticketId: string,
): Ticket | null {
  const t = ctx().tickets.find((x) => x.id === ticketId);
  if (!t || t.tenantId !== tenantId) return null;
  return t;
}

export function mockDeleteTicket(input: {
  tenantId: string;
  ticketId: string;
  actorUserId: string;
}): void {
  const s = ctx();
  const idx = s.tickets.findIndex((t) => t.id === input.ticketId);
  if (idx < 0) throw new Error("Ticket not found");
  const ticket = s.tickets[idx];
  if (ticket.tenantId !== input.tenantId) throw new Error("Ticket not found");
  s.tickets.splice(idx, 1);
  mockAppendActivity({
    tenantId: input.tenantId,
    action: "ticket.deleted",
    entityType: "ticket",
    entityId: input.ticketId,
    userId: input.actorUserId,
    metadata: {
      orderId: ticket.order_id,
      type: ticket.type,
      status: ticket.status,
    },
  });
}

export function mockAddTicketNote(input: {
  tenantId: string;
  ticketId: string;
  body: string;
  actorUserId: string;
}): Ticket {
  const s = ctx();
  const idx = s.tickets.findIndex((t) => t.id === input.ticketId);
  if (idx < 0) throw new Error("Ticket not found");
  const t = s.tickets[idx];
  if (t.tenantId !== input.tenantId) throw new Error("Ticket not found");
  const now = iso();
  const note = {
    id: crypto.randomUUID(),
    body: input.body,
    userId: input.actorUserId,
    createdAt: now,
  };
  const next: Ticket = {
    ...t,
    notes: t.notes ?? input.body,
    notesHistory: [...(t.notesHistory ?? []), note],
    updatedAt: now,
  };
  s.tickets[idx] = next;
  mockAppendActivity({
    tenantId: input.tenantId,
    action: "ticket.note_added",
    entityType: "ticket",
    entityId: input.ticketId,
    userId: input.actorUserId,
    metadata: { noteId: note.id },
  });
  return next;
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

export function mockCloseTicket(input: {
  tenantId: string;
  ticketId: string;
  actorUserId: string;
}): Ticket {
  const s = ctx();
  const idx = s.tickets.findIndex((t) => t.id === input.ticketId);
  if (idx < 0) throw new Error("Ticket not found");
  const t = s.tickets[idx];
  if (t.tenantId !== input.tenantId) throw new Error("Ticket not found");
  if (t.status !== "resolved") {
    throw new Error("Only resolved tickets can be closed");
  }
  const now = iso();
  const next: Ticket = {
    ...t,
    status: "closed",
    updatedAt: now,
  };
  s.tickets[idx] = next;
  mockAppendActivity({
    tenantId: input.tenantId,
    action: "ticket.closed",
    entityType: "ticket",
    entityId: input.ticketId,
    userId: input.actorUserId,
    metadata: {
      orderId: t.order_id,
      type: t.type,
      previousStatus: t.status,
    },
  });
  return next;
}

export async function mockResolveTicket(input: {
  tenantId: string;
  ticketId: string;
  createExchangeShipment?: boolean;
  createShipmentType?: "return" | "exchange";
  resolutionKind?: TicketResolutionKind;
  resolutionDetails?: string;
  refundAmount?: number;
  actorUserId: string;
}): Promise<Ticket> {
  const s = ctx();
  const idx = s.tickets.findIndex((t) => t.id === input.ticketId);
  if (idx < 0) throw new Error("Ticket not found");
  const t = s.tickets[idx];
  if (t.tenantId !== input.tenantId) throw new Error("Ticket not found");

  const shipmentIds = [...(t.shipmentIds ?? [])];
  const shipmentType =
    input.createShipmentType ??
    (input.createExchangeShipment && t.type === "exchange" ? "exchange" : undefined);
  let createdShipmentId: string | undefined;
  if (shipmentType) {
    const sh = await mockCreateShipmentForOrder({
      tenantId: input.tenantId,
      orderId: t.order_id,
      type: shipmentType,
      actorUserId: input.actorUserId,
    });
    shipmentIds.push(sh.id);
    createdShipmentId = sh.id;
  }

  const now = iso();
  const kind =
    input.resolutionKind ??
    (shipmentType === "return"
      ? "return"
      : shipmentType === "exchange"
        ? "exchange"
        : "resolved");
  const next: Ticket = {
    ...t,
    shipmentIds,
    resolution: {
      kind,
      details: input.resolutionDetails,
      refundAmount: input.refundAmount,
      shipmentId: createdShipmentId,
      resolvedByUserId: input.actorUserId,
      resolvedAt: now,
    },
    status: "resolved",
    updatedAt: now,
  };
  s.tickets[idx] = next;
  const resolvedValue = Math.max(
    0,
    input.refundAmount ?? mockGetOrder(input.tenantId, t.order_id)?.payment.total_amount ?? 0,
  );
  if (resolvedValue > 0) {
    const date = now.slice(0, 10);
    if (t.type === "return" || kind === "refund_without_shipment") {
      mockAnalyticsDailyIncrement({
        tenantId: input.tenantId,
        date,
        deltas: {
          returns_value: resolvedValue,
          refunds_value: resolvedValue,
        },
      });
    } else if (t.type === "exchange") {
      mockAnalyticsDailyIncrement({
        tenantId: input.tenantId,
        date,
        deltas: { exchanges_value: resolvedValue },
      });
    }
  }
  mockAppendActivity({
    tenantId: input.tenantId,
    action: "ticket.resolved",
    entityType: "ticket",
    entityId: input.ticketId,
    userId: input.actorUserId,
    metadata: {
      kind,
      ...(createdShipmentId ? { shipmentId: createdShipmentId } : {}),
      ...(input.refundAmount != null ? { refundAmount: input.refundAmount } : {}),
      createExchangeShipment: input.createExchangeShipment ?? false,
    },
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

export function mockAppendOutboundWebhookDeliveryLog(
  row: OutboundWebhookDeliveryLog,
): void {
  const s = ctx();
  s.outboundWebhookLogs.push(row);
}

export function mockListOutboundWebhookDeliveryLogs(
  tenantId: string,
  limit: number,
): OutboundWebhookDeliveryLog[] {
  const s = ctx();
  return s.outboundWebhookLogs
    .filter((r) => r.tenantId === tenantId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
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

function applyStringPatch(
  target: Record<string, string | undefined>,
  fields: Record<string, string | null | undefined>,
) {
  for (const [key, val] of Object.entries(fields)) {
    if (val === undefined) continue;
    if (val === null || val.trim() === "") {
      delete target[key];
    } else {
      target[key] = val.trim();
    }
  }
}

export function mockSetTenantJntEgyptFields(
  tenantId: string,
  fields: {
    [K in keyof NonNullable<TenantIntegrationsDoc["jntEgypt"]>]?:
      | NonNullable<TenantIntegrationsDoc["jntEgypt"]>[K]
      | null;
  },
) {
  const s = ctx();
  const integrations: TenantIntegrationsDoc = {
    ...(s.tenantIntegrations[tenantId] ?? {}),
  };
  const jnt = { ...(integrations.jntEgypt ?? {}) };
  applyStringPatch(
    jnt as Record<string, string | undefined>,
    fields as Record<string, string | null | undefined>,
  );
  if (Object.keys(jnt).length === 0) {
    delete integrations.jntEgypt;
  } else {
    integrations.jntEgypt = jnt;
  }
  if (Object.keys(integrations).length === 0) {
    delete s.tenantIntegrations[tenantId];
  } else {
    s.tenantIntegrations[tenantId] = integrations;
  }
}

export function mockSetTenantFedExFields(
  tenantId: string,
  fields: {
    [K in keyof NonNullable<TenantIntegrationsDoc["fedex"]>]?:
      | NonNullable<TenantIntegrationsDoc["fedex"]>[K]
      | null;
  },
) {
  const s = ctx();
  const integrations: TenantIntegrationsDoc = {
    ...(s.tenantIntegrations[tenantId] ?? {}),
  };
  const fedex = { ...(integrations.fedex ?? {}) };
  applyStringPatch(
    fedex as Record<string, string | undefined>,
    fields as Record<string, string | null | undefined>,
  );
  if (Object.keys(fedex).length === 0) {
    delete integrations.fedex;
  } else {
    integrations.fedex = fedex;
  }
  if (Object.keys(integrations).length === 0) {
    delete s.tenantIntegrations[tenantId];
  } else {
    s.tenantIntegrations[tenantId] = integrations;
  }
}

export function mockSetTenantWhatsAppCloudFields(
  tenantId: string,
  fields: {
    verifyToken?: string | null;
    accessToken?: string | null;
    phoneNumberId?: string | null;
    businessAccountId?: string | null;
    appSecret?: string | null;
  },
) {
  const s = ctx();
  const integrations: TenantIntegrationsDoc = {
    ...(s.tenantIntegrations[tenantId] ?? {}),
  };
  const whatsapp = { ...(integrations.whatsapp ?? {}) };
  const apply = (
    key:
      | "verifyToken"
      | "accessToken"
      | "phoneNumberId"
      | "businessAccountId"
      | "appSecret",
    val: string | null | undefined,
  ) => {
    if (val === undefined) return;
    if (val === null || val.trim() === "") {
      delete whatsapp[key];
    } else {
      whatsapp[key] = val.trim();
    }
  };
  apply("verifyToken", fields.verifyToken);
  apply("accessToken", fields.accessToken);
  apply("phoneNumberId", fields.phoneNumberId);
  apply("businessAccountId", fields.businessAccountId);
  apply("appSecret", fields.appSecret);
  if (Object.keys(whatsapp).length === 0) {
    delete integrations.whatsapp;
  } else {
    integrations.whatsapp = whatsapp;
  }
  if (Object.keys(integrations).length === 0) {
    delete s.tenantIntegrations[tenantId];
  } else {
    s.tenantIntegrations[tenantId] = integrations;
  }
}

export function mockSetTenantStorefrontOrderFields(
  tenantId: string,
  fields: {
    webhookSecret?: string | null;
    secretHeaderName?: string | null;
  },
) {
  const s = ctx();
  const integrations: TenantIntegrationsDoc = {
    ...(s.tenantIntegrations[tenantId] ?? {}),
  };
  const storefrontOrders = { ...(integrations.storefrontOrders ?? {}) };
  const apply = (
    key: "webhookSecret" | "secretHeaderName",
    val: string | null | undefined,
  ) => {
    if (val === undefined) return;
    if (val === null || val.trim() === "") {
      delete storefrontOrders[key];
    } else {
      storefrontOrders[key] = val.trim();
    }
  };
  apply("webhookSecret", fields.webhookSecret);
  apply("secretHeaderName", fields.secretHeaderName);
  if (Object.keys(storefrontOrders).length === 0) {
    delete integrations.storefrontOrders;
  } else {
    integrations.storefrontOrders = storefrontOrders;
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
  to: "ready_for_shipping" | "awb_created" | "warehouse_picking";
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
  const next: Order = {
    ...order,
    status: input.to,
    statusUpdatedAt: now,
    updatedAt: now,
  };
  s.orders[oidx] = next;
  if (
    (from === "warehouse_packed" || from === "warehouse_picking") &&
    (input.to === "awb_created" || input.to === "warehouse_picking")
  ) {
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
    updatedAt: iso(),
  };
}

export function mockAnalyticsDailyIncrement(input: {
  tenantId: string;
  date: string;
  deltas: Partial<{
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
}) {
  const s = ctx();
  const id = `${input.tenantId}_${input.date}`;
  const base =
    s.analyticsDaily[id] ?? emptyAnalyticsDailyRow(input.tenantId, input.date);
  const next: AnalyticsDaily = { ...base };
  const d = input.deltas;
  if (d.orders_count) next.orders_count += d.orders_count;
  if (d.orders_value) next.orders_value += d.orders_value;
  if (d.cogs_value) next.cogs_value += d.cogs_value;
  if (d.confirmed_orders_count) {
    next.confirmed_orders_count += d.confirmed_orders_count;
  }
  if (d.shipments_count) next.shipments_count += d.shipments_count;
  if (d.shipping_cost) next.shipping_cost += d.shipping_cost;
  if (d.delivery_shipments_count) {
    next.delivery_shipments_count += d.delivery_shipments_count;
  }
  if (d.delivery_shipping_cost) {
    next.delivery_shipping_cost += d.delivery_shipping_cost;
  }
  if (d.return_shipments_count) {
    next.return_shipments_count += d.return_shipments_count;
  }
  if (d.return_shipping_cost) {
    next.return_shipping_cost += d.return_shipping_cost;
  }
  if (d.exchange_shipments_count) {
    next.exchange_shipments_count += d.exchange_shipments_count;
  }
  if (d.exchange_shipping_cost) {
    next.exchange_shipping_cost += d.exchange_shipping_cost;
  }
  if (d.returns_count) next.returns_count += d.returns_count;
  if (d.returns_value) next.returns_value += d.returns_value;
  if (d.refunds_value) next.refunds_value += d.refunds_value;
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
  let cogs_value = 0;
  for (const o of orders) {
    if (o.createdAt.slice(0, 10) !== date) continue;
    orders_count += 1;
    orders_value += o.payment.total_amount;
    cogs_value += mockOrderCogsValue(o);
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
  let delivery_shipments_count = 0;
  let delivery_shipping_cost = 0;
  let return_shipments_count = 0;
  let return_shipping_cost = 0;
  let exchange_shipments_count = 0;
  let exchange_shipping_cost = 0;
  for (const sh of s.shipments) {
    if (sh.tenantId !== tenantId) continue;
    if (sh.createdAt.slice(0, 10) !== date) continue;
    shipments_count += 1;
    const o = orderById.get(sh.order_id);
    const fee = sh.shipping_fees ?? o?.shipping?.cost ?? 0;
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
  for (const t of s.tickets) {
    if (t.tenantId !== tenantId) continue;
    if (t.createdAt.slice(0, 10) !== date) continue;
    if (t.type === "return") {
      returns_count += 1;
    } else if (t.type === "exchange") {
      exchanges_count += 1;
    }
  }
  for (const t of s.tickets) {
    if (t.tenantId !== tenantId) continue;
    if (!t.resolution?.resolvedAt || t.resolution.resolvedAt.slice(0, 10) !== date) {
      continue;
    }
    const value = Math.max(
      0,
      t.resolution.refundAmount ?? orderById.get(t.order_id)?.payment.total_amount ?? 0,
    );
    if (t.type === "return" || t.resolution.kind === "refund_without_shipment") {
      returns_value += value;
      refunds_value += value;
    } else if (t.type === "exchange") {
      exchanges_value += value;
    }
  }

  const id = `${tenantId}_${date}`;
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

export function mockAppendOrderEvent(input: {
  tenantId: string;
  orderId: string;
  action: string;
  userId: string;
  metadata?: Record<string, unknown>;
}): void {
  const s = ctx();
  const id = crypto.randomUUID();
  const createdAt = iso();
  s.orderEvents.unshift({
    id,
    tenantId: input.tenantId,
    orderId: input.orderId,
    action: input.action,
    userId: input.userId,
    metadata: input.metadata ?? {},
    createdAt,
  });
  if (s.orderEvents.length > 2000) s.orderEvents.length = 2000;
}

export function mockListOrderEvents(input: {
  tenantId: string;
  orderId: string;
  limit: number;
  actionPrefix?: string;
}): OrderEvent[] {
  const s = ctx();
  const p = input.actionPrefix?.trim();
  let rows = s.orderEvents.filter(
    (e) => e.tenantId === input.tenantId && e.orderId === input.orderId,
  );
  if (p) rows = rows.filter((e) => e.action.startsWith(p));
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows.slice(0, input.limit);
}

export function mockListRecentOrderEventsByTenant(input: {
  tenantId: string;
  limit: number;
  sinceIso?: string;
}): OrderEvent[] {
  const s = ctx();
  let rows = s.orderEvents.filter((e) => e.tenantId === input.tenantId);
  if (input.sinceIso?.trim()) {
    const t = input.sinceIso.trim();
    rows = rows.filter((e) => e.createdAt >= t);
  }
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows.slice(0, input.limit);
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

export function mockListPlatformPackages(): PlatformPackage[] {
  return Object.values(ctx().platformPackages).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );
}

export function mockGetPlatformPackage(
  packageId: string,
): PlatformPackage | null {
  return ctx().platformPackages[packageId] ?? null;
}

export function mockCreatePlatformPackage(
  pkg: PlatformPackage,
): PlatformPackage {
  ctx().platformPackages[pkg.id] = pkg;
  return pkg;
}

export function mockUpdatePlatformPackage(input: {
  packageId: string;
  name?: string;
  description?: string | null;
  limits?: PlatformPackage["limits"];
  features?: Partial<PlatformPackage["features"]>;
  supportTier?: PlatformPackage["supportTier"];
  active?: boolean;
}): PlatformPackage {
  const s = ctx();
  const current = s.platformPackages[input.packageId];
  if (!current) {
    const e = new Error("Package not found") as Error & { status: number };
    e.status = 404;
    throw e;
  }
  const next: PlatformPackage = {
    ...current,
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.description !== undefined
      ? { description: input.description?.trim() || undefined }
      : {}),
    ...(input.limits !== undefined ? { limits: input.limits } : {}),
    ...(input.features !== undefined
      ? { features: { ...current.features, ...input.features } }
      : {}),
    ...(input.supportTier !== undefined ? { supportTier: input.supportTier } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
    updatedAt: iso(),
  };
  s.platformPackages[input.packageId] = next;
  return next;
}

export function mockGetTenantEntitlements(
  tenantId: string,
): TenantEntitlements | null {
  return ctx().tenantEntitlements[tenantId] ?? null;
}

export function mockAssignTenantPackage(
  entitlements: TenantEntitlements,
): TenantEntitlements {
  ctx().tenantEntitlements[entitlements.tenantId] = entitlements;
  return entitlements;
}
