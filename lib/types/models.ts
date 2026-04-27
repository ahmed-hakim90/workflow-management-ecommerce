/** Order lifecycle per Store OMS spec */
export type OrderStatus =
  | "pending_confirmation"
  | "confirmed"
  | "invoicing"
  | "ready_for_warehouse"
  | "packed"
  | "shipped"
  | "delivered"
  | "follow_up"
  | "cancelled";

export type PaymentStatus = "paid" | "partial" | "cod";

export interface Payment {
  payment_status: PaymentStatus;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  cod_amount: number;
}

export interface OrderCustomer {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface OrderInvoice {
  number?: string;
  issuedAt?: string;
}

/** Single line on an order (WooCommerce / manual). */
export interface OrderLineItem {
  id?: string;
  name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface OrderShipping {
  method?: string;
  cost: number;
}

/**
 * JSON-serializable value (WooCommerce payloads, snapshots).
 * Matches Firestore-supported scalars and nested structure.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export interface Order {
  id: string;
  tenantId: string;
  customer: OrderCustomer;
  payment: Payment;
  status: OrderStatus;
  invoice?: OrderInvoice;
  shipmentIds: string[];
  assigned_to?: string | null;
  wooCommerceOrderId?: string;
  lineItems?: OrderLineItem[];
  shipping?: OrderShipping;
  /** Customer / staff notes from source system */
  notes?: string;
  /**
   * Last full WooCommerce order resource (webhook JSON body), for audit / integrations.
   * Omitted in list API responses to keep payloads small; present on `GET` order detail.
   */
  woocommerceOrderSnapshot?: JsonValue;
  createdAt: string;
  updatedAt: string;
}

export type ShipmentType = "delivery" | "return" | "exchange";

export type ShipmentStatus =
  | "pending"
  | "created"
  | "packed"
  | "shipped"
  | "delivered"
  | "failed"
  | "cancelled";

export interface Shipment {
  id: string;
  tenantId: string;
  order_id: string;
  awb: string;
  type: ShipmentType;
  status: ShipmentStatus;
  provider: "bosta" | "mock";
  externalId?: string;
  /** Carrier / quoted fee for this shipment (falls back to order shipping cost in analytics). */
  shipping_fees?: number;
  /** Staff who created the shipment (Bosta / policy). */
  createdByUserId?: string;
  createdByUserName?: string;
  packedAt?: string;
  shippedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type TicketType = "return" | "exchange" | "complaint";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export interface Ticket {
  id: string;
  tenantId: string;
  order_id: string;
  type: TicketType;
  status: TicketStatus;
  assigned_to?: string | null;
  notes?: string;
  shipmentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type UserRole =
  | "admin"
  | "moderator"
  | "confirmation"
  | "invoicing"
  | "warehouse"
  | "support";

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email?: string;
  /** Set when the account signs in with Firebase Auth (onboarding / login). */
  firebaseUid?: string;
  role: UserRole;
  permissions: string[];
  daily_target: number;
  createdAt: string;
  updatedAt: string;
}

/** One company / merchant (Firestore `tenants` document id = `id`). */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  /** Per-tenant staff API key (send as Bearer + X-User-Id + X-User-Role). */
  staffApiKey: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Daily financial aggregates per tenant (UTC date key).
 * Document id: `${tenantId}_${date}` (date = YYYY-MM-DD).
 */
export interface AnalyticsDaily {
  id: string;
  tenantId: string;
  date: string;
  orders_count: number;
  orders_value: number;
  /** Orders moved to confirmed on this day (event-driven); rebuild uses activity logs when available. */
  confirmed_orders_count: number;
  shipments_count: number;
  shipping_cost: number;
  returns_count: number;
  returns_value: number;
  exchanges_count: number;
  /** Replacement-order delta not modeled yet; kept for spec alignment. */
  exchanges_value: number;
  updatedAt: string;
}

/** Daily aggregates per user for KPI */
export interface UserStats {
  id: string;
  tenantId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  confirmed: number;
  invoiced: number;
  packed: number;
  updatedAt: string;
}

export type ActivityEntityType = "order" | "shipment" | "ticket" | "user";

export interface ActivityLog {
  id: string;
  tenantId: string;
  action: string;
  entityType: ActivityEntityType;
  entityId: string;
  userId: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export type WebhookIngestSource = "woocommerce" | "storefront_order_forwarding";

/**
 * Inbound webhook delivery outcome (for Settings diagnostics). No secrets; optional error text is truncated on write.
 */
export type WebhookIngestOutcome =
  | "no_secret_503"
  | "invalid_signature_401"
  | "invalid_secret_401"
  | "invalid_json_400"
  | "invalid_payload_400"
  | "duplicate_200"
  | "order_upserted_200"
  | "processing_failed_400"
  | "claim_failed_500";

export interface WebhookIngestLog {
  id: string;
  tenantId: string;
  source: WebhookIngestSource;
  /** WooCommerce `X-WC-Webhook-Delivery-Id` when present. */
  deliveryId: string;
  outcome: WebhookIngestOutcome;
  httpStatus: number;
  orderId?: string;
  wooOrderId?: string;
  errorMessage?: string;
  requestBodyBytes: number;
  createdAt: string;
}

export type AutomationShipmentStage = "confirmed" | "invoiced";

export interface TenantAutomationSettings {
  auto_create_shipment: boolean;
  create_shipment_stage: AutomationShipmentStage;
  /**
   * رسالة واتساب الافتراضية لفريق التأكيد عند التواصل مع العميل.
   * Placeholders: `{name}`, `{orderId}`, `{awb}`.
   */
  whatsappMessageTemplate?: string;
}

export const defaultTenantAutomation: TenantAutomationSettings = {
  auto_create_shipment: false,
  create_shipment_stage: "confirmed",
  whatsappMessageTemplate: "مرحباً {name} — متابعة طلبك رقم {orderId}",
};

/** Stored under Firestore `tenant_settings` doc field `integrations` (per tenant). */
export interface TenantWooCommerceIntegration {
  /** Same string as WooCommerce → Webhooks → Secret (HMAC). */
  webhookSecret?: string;
  /** Store origin only, e.g. https://shop.example.com (no trailing slash). */
  storeUrl?: string;
  /** WooCommerce REST API consumer key (ck_...). */
  consumerKey?: string;
  /** WooCommerce REST API consumer secret (cs_...). */
  consumerSecret?: string;
}

export interface TenantBostaIntegration {
  apiKey?: string;
  /** Override API base; default Bosta production URL if unset. */
  baseUrl?: string;
  /** Bosta city _id from city list API (required for real deliveries). */
  defaultCityId?: string;
  /** Bosta zone id within city (optional). */
  defaultZoneId?: string;
  defaultBuildingNumber?: string;
  /** First address line when order has no structured address. */
  defaultAddressLine?: string;
  /** Package description / notes for Bosta specs. */
  packageDescription?: string;
}

export interface TenantStorefrontOrdersIntegration {
  /** Shared secret expected from the store frontend when it forwards created orders. */
  webhookSecret?: string;
  /** Header that carries `webhookSecret`; defaults to `x-api-secret`. */
  secretHeaderName?: string;
}

export interface TenantWarehouseSettings {
  /** true = one AWB scan from `ready_for_warehouse` → `shipped` (per tenant). */
  singleScanFulfills?: boolean;
  /** Min ms before `packed` → `shipped` scan; default 3500. */
  scanCooldownMs?: number;
  /**
   * @deprecated Prefer `automation.whatsappMessageTemplate` — kept for migration reads.
   */
  whatsappMessageTemplate?: string;
}

export const defaultTenantWarehouse: Required<
  Pick<TenantWarehouseSettings, "singleScanFulfills" | "scanCooldownMs">
> = {
  singleScanFulfills: false,
  scanCooldownMs: 3500,
};

export interface TenantIntegrationsDoc {
  woocommerce?: TenantWooCommerceIntegration;
  bosta?: TenantBostaIntegration;
  storefrontOrders?: TenantStorefrontOrdersIntegration;
  /** سلوك المسح في المخزن (بدون واتساب). */
  warehouse?: TenantWarehouseSettings;
}

/** Fields shown on each Kanban card (tenant-configurable). */
export type KanbanCardField =
  | "customer"
  | "total"
  | "payment"
  | "status"
  | "assigned"
  | "woo";

/** One swimlane column: which order statuses appear here. */
export interface KanbanColumnConfig {
  id: string;
  title: string;
  statuses: OrderStatus[];
  cardFields?: KanbanCardField[];
}

export interface TenantKanbanSettings {
  columns: KanbanColumnConfig[];
}
