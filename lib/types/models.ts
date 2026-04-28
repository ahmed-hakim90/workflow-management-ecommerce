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

export const ORDER_STATUSES: OrderStatus[] = [
  "pending_confirmation",
  "confirmed",
  "invoicing",
  "ready_for_warehouse",
  "packed",
  "shipped",
  "delivered",
  "follow_up",
  "cancelled",
];

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
  product_id?: string;
  variation_id?: string;
  name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  product_url?: string;
  attributes?: Record<string, string>;
  meta?: Record<string, string>;
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
  cancelReason?: string;
  cancelledAt?: string;
  cancelledByUserId?: string;
  wooCommerceOrderId?: string;
  /** Computed API field for opening the source order in WooCommerce admin. */
  wooCommerceOrderAdminUrl?: string;
  /** Computed API fields from latest shipment for list views. */
  latestShipmentAwb?: string;
  latestShipmentCarrierTrackingStatus?: string;
  latestShipmentStatus?: ShipmentStatus;
  /** Computed API fields from the latest `order.whatsapp_sent` activity. */
  whatsappSentAt?: string;
  whatsappSentByUserId?: string;
  whatsappSentByUserName?: string;
  whatsappSentPhone?: string;
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
  /** Carrier-facing label/status from Bosta tracking, separate from internal warehouse status. */
  carrierTrackingStatus?: string;
  lastTrackingSyncAt?: string;
  trackingHistory?: ShipmentTrackingEvent[];
  cancelledAt?: string;
  cancelledByUserId?: string;
  packedAt?: string;
  shippedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentTrackingEvent {
  at: string;
  status: string;
  details?: string;
}

export type TicketType = "return" | "exchange" | "complaint";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export interface TicketNote {
  id: string;
  body: string;
  userId: string;
  createdAt: string;
}

export type TicketResolutionKind =
  | "resolved"
  | "return"
  | "exchange"
  | "refund_without_shipment";

export interface TicketResolution {
  kind: TicketResolutionKind;
  details?: string;
  refundAmount?: number;
  shipmentId?: string;
  resolvedByUserId: string;
  resolvedAt: string;
}

export interface Ticket {
  id: string;
  tenantId: string;
  order_id: string;
  type: TicketType;
  status: TicketStatus;
  assigned_to?: string | null;
  notes?: string;
  notesHistory?: TicketNote[];
  resolution?: TicketResolution;
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
  language?: "en" | "ar";
  role: UserRole;
  permissions: string[];
  daily_target: number;
  createdAt: string;
  updatedAt: string;
}

/** One company / merchant (Firestore `tenants` document id = `id`). */
export type TenantStatus = "active" | "suspended";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  status?: TenantStatus;
  suspendedAt?: string;
  suspendedReason?: string;
  /** Per-tenant staff API key (send as Bearer + X-User-Id + X-User-Role). */
  staffApiKey: string;
  createdAt: string;
  updatedAt: string;
}

export type PlatformAdminRole = "owner" | "operator";

export interface PlatformAdmin {
  id: string;
  name: string;
  email?: string;
  role: PlatformAdminRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformPackageLimits {
  maxUsers?: number;
  maxOrdersPerMonth?: number;
  maxWebhookEventsPerMonth?: number;
}

export interface PlatformPackageFeatures {
  woocommerce: boolean;
  bosta: boolean;
  storefrontOrders: boolean;
  outboundWebhooks: boolean;
}

export type PlatformSupportTier = "standard" | "priority" | "dedicated";

export interface PlatformPackage {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  limits: PlatformPackageLimits;
  features: PlatformPackageFeatures;
  supportTier: PlatformSupportTier;
  createdAt: string;
  updatedAt: string;
}

export interface TenantEntitlements {
  tenantId: string;
  packageId: string | null;
  packageSnapshot?: PlatformPackage;
  overrides?: Partial<PlatformPackageLimits> & {
    features?: Partial<PlatformPackageFeatures>;
    supportTier?: PlatformSupportTier;
  };
  assignedAt?: string;
  assignedBy?: string;
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
  | "diagnostic_200"
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
   * Placeholders include legacy `{name}`, `{orderId}`, `{wooOrderId}`, `{awb}`,
   * `{orderLink}` plus dot-paths like `{customer.address}`, `{payment.total}`,
   * `{order.shipping.method}` and product summaries via `{items.summary}`.
   */
  whatsappMessageTemplate?: string;
  /** Optional per-tenant order/tracking URL template. Placeholders: `{orderId}`, `{wooOrderId}`. */
  orderLinkTemplate?: string;
  /** Outbound HTTP webhooks fired after order status changes. */
  outboundWebhooks?: TenantOutboundWebhook[];
}

export const defaultTenantAutomation: TenantAutomationSettings = {
  auto_create_shipment: false,
  create_shipment_stage: "confirmed",
  whatsappMessageTemplate:
    "مرحباً {name} — متابعة طلبك رقم {orderId}\n{orderLink}",
};

export interface TenantOutboundWebhook {
  id: string;
  name: string;
  enabled: boolean;
  url: string;
  /** Optional HMAC secret used for X-OMS-Signature. */
  secret?: string;
  /** Fire only when the order moves into one of these statuses. Empty means never. */
  statuses: OrderStatus[];
  /** Include the heavy WooCommerce snapshot when available. Off by default. */
  includeOrderSnapshot?: boolean;
}

export interface OutboundWebhookDeliveryLog {
  id: string;
  tenantId: string;
  webhookId: string;
  webhookName: string;
  event: "order.status_changed";
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  success: boolean;
  httpStatus?: number;
  errorMessage?: string;
  createdAt: string;
}

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
