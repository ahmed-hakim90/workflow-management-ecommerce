/**
 * Order lifecycle per Store OMS production spec.
 *
 * Pipeline:
 *   new → pending_confirmation → confirmed → invoice_required → invoiced
 *     → ready_for_shipping → awb_created → warehouse_picking → warehouse_packed
 *     → out_for_shipping → delivered → closed
 *
 * Branches:
 *   * out_for_shipping → failed_delivery → {retry|returned|exchange_requested}
 *   * delivered → returned | exchange_requested
 *   * returned/exchange_requested → replacement_created → ready_for_shipping
 *   * Any pre-invoice status → cancelled → closed
 */
export type OrderStatus =
  | "new"
  | "pending_confirmation"
  | "confirmed"
  | "cancelled"
  | "invoice_required"
  | "invoiced"
  | "ready_for_shipping"
  | "awb_created"
  | "warehouse_picking"
  | "warehouse_packed"
  | "out_for_shipping"
  | "delivered"
  | "failed_delivery"
  | "returned"
  | "exchange_requested"
  | "replacement_created"
  | "closed";

export const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "pending_confirmation",
  "confirmed",
  "cancelled",
  "invoice_required",
  "invoiced",
  "ready_for_shipping",
  "awb_created",
  "warehouse_picking",
  "warehouse_packed",
  "out_for_shipping",
  "delivered",
  "failed_delivery",
  "returned",
  "exchange_requested",
  "replacement_created",
  "closed",
];

/**
 * Payment lifecycle:
 * - `paid`     — fully prepaid online
 * - `unpaid`   — prepay expected but not received yet
 * - `partial`  — partial prepayment + cash on delivery for the rest
 * - `cod`      — cash on delivery for the full amount
 */
export type PaymentStatus = "paid" | "unpaid" | "partial" | "cod";

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
  /** Merchant-side unit cost, if supplied by the store/catalog metadata. */
  unit_cost?: number;
  /** Merchant-side cost for this line (`unit_cost * quantity` unless explicitly supplied). */
  line_cost?: number;
  product_url?: string;
  attributes?: Record<string, string>;
  meta?: Record<string, string>;
}

export interface OrderShipping {
  method?: string;
  cost: number;
}

/** Inbound commerce source; extensible for multi-channel. */
export type OrderSource = "woocommerce";

/**
 * JSON-serializable value (WooCommerce payloads, snapshots).
 * JSON-compatible scalars and nested structure.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

/**
 * Fields loaded for order lists (API list).
 * لا نضمّن lineItems ولا لقطة Woo الخام — لتخفيف القراءات.
 */
export type OrderListSummary = Omit<
  Order,
  "lineItems" | "woocommerceOrderSnapshot"
> & {
  lineItems?: undefined;
  woocommerceOrderSnapshot?: undefined;
};

/** Full order for detail APIs (includes line items and optional raw snapshot ref). */
export type OrderDetail = Order;

export interface Order {
  id: string;
  tenantId: string;
  customer: OrderCustomer;
  payment: Payment;
  status: OrderStatus;
  /** ISO timestamp of the most recent status change. Used for SLA + activity ordering. */
  statusUpdatedAt?: string;
  invoice?: OrderInvoice;
  shipmentIds: string[];
  assigned_to?: string | null;
  cancelReason?: string;
  cancelledAt?: string;
  cancelledByUserId?: string;
  /** Same as Woo order id when source is Woo; stable external key for idempotency. */
  externalOrderId?: string;
  /** Where the order was created (Woo, future channels). */
  source?: OrderSource;
  /** Last successful webhook/map persist for this order from the source. */
  lastSyncedAt?: string;
  /** Denormalized count for list UIs without reading lineItems. */
  lineItemCount?: number;
  /** Points to stored raw payload (e.g. subcollection doc id) when not inlined. */
  webhookPayloadRef?: string;
  /** SHA-256 of normalized ingest payload; skips redundant logs when unchanged. */
  lastWebhookSyncFingerprint?: string;
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

export type ShippingProvider = "bosta" | "jnt_egypt" | "fedex" | "mock";

export type ShipmentLabelFormat = "pdf" | "zpl" | "thermal";

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
  provider: ShippingProvider;
  externalId?: string;
  serviceCode?: string;
  labelFormat?: ShipmentLabelFormat;
  labelUrl?: string;
  labelData?: string;
  thermalLabelUrl?: string;
  thermalLabelData?: string;
  carrierAccountRef?: string;
  rawCarrierStatus?: string;
  /** Cash amount requested from the carrier on delivery. */
  cod_amount?: number;
  /** Whether the carrier should allow package inspection/opening where supported. */
  allow_opening?: boolean;
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
  | "support"
  | "viewer";

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email?: string;
  /** Supabase Auth user id (`auth.users.id`). */
  supabaseUserId?: string;
  language?: "en" | "ar";
  role: UserRole;
  permissions: string[];
  daily_target: number;
  createdAt: string;
  updatedAt: string;
}

/** One company / merchant. */
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
  jntEgypt: boolean;
  fedex: boolean;
  storefrontOrders: boolean;
  outboundWebhooks: boolean;
  /** Meta WhatsApp Cloud API (tenant_settings.integrations.whatsapp). */
  whatsapp: boolean;
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
  /** Cost of goods sold inferred from order line item cost fields. */
  cogs_value: number;
  /** Orders moved to confirmed on this day (event-driven); rebuild uses activity logs when available. */
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
  /** Cash refund amount captured when return/refund tickets are resolved. */
  refunds_value: number;
  exchanges_count: number;
  /** Replacement-order/refund delta captured from resolved exchange tickets. */
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

/** Append-only rows in `order_events` — order-scoped audit stream. */
export interface OrderEvent {
  id: string;
  tenantId: string;
  orderId: string;
  action: string;
  userId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type WebhookIngestSource = "woocommerce" | "storefront_order_forwarding";

/** Normalized lifecycle for dashboards (maps from legacy `outcome`). */
export type WebhookIngestStatus = "received" | "processed" | "failed" | "duplicate";

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
  /** Same as `deliveryId` for Woo; alias for generic “webhook id” wording. */
  webhookId: string;
  /** e.g. `X-WC-Webhook-Topic` when available. */
  eventType?: string;
  outcome: WebhookIngestOutcome;
  /** Derived from `outcome` for filtering (duplicate / processed / failed / received). */
  status: WebhookIngestStatus;
  httpStatus: number;
  orderId?: string;
  wooOrderId?: string;
  externalOrderId?: string;
  errorMessage?: string;
  requestBodyBytes: number;
  /** When the HTTP handler accepted the request (start of processing). */
  receivedAt: string;
  /** When processing finished (success or failure). */
  processedAt: string;
  /** Legacy field; mirrors `receivedAt` for older readers. */
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
  /** When true, new Woo orders trigger Cloud API template + n8n events (server-side only). */
  whatsappAutomationEnabled?: boolean;
  /** n8n workflow entry URL for OMS → automation events. */
  n8nWebhookUrl?: string;
  /** HMAC secret for `X-OMS-Signature` on posts to n8n. */
  n8nWebhookSecret?: string;
  /** WhatsApp approved template for order confirmation flow. */
  orderConfirmationTemplateName?: string;
  orderConfirmationTemplateLanguage?: string;
  /**
   * When true, incoming WhatsApp messages on a linked order run the built-in keyword classifier
   * (still logged in OMS; n8n receives `chat.reply.classified`).
   */
  inlineReplyClassifier?: boolean;
  /** SLA: دقائق لأول رد على رسالة عميل واردة (0 يعطل المؤقت). */
  inboxSlaFirstResponseMinutes?: number;
  /** SLA: ساعات خمول قبل متابعة (pending_followup). */
  inboxSlaCustomerIdleHours?: number;
  /** SLA: انتظار موافقة/إجراء داخلي قبل إشعار. */
  inboxSlaInternalActionHours?: number;
  /** تصنيف نوايا الرد: كلمات مفتاحية فقط، OpenRouter، Ollama، أو هجين. */
  replyIntentClassifierProvider?: "heuristic" | "openrouter" | "ollama" | "hybrid";
  /** عتبة الثقة للهجين قبل استدعاء LLM (افتراضي 0.72). */
  replyIntentClassifierLlmThreshold?: number;
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

/** Stored under Supabase `tenant_settings.integrations` (per tenant). */
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

export interface TenantJntEgyptIntegration {
  apiAccount?: string;
  customerCode?: string;
  password?: string;
  digestSecret?: string;
  baseUrl?: string;
  environment?: "test" | "prod";
  senderName?: string;
  senderPhone?: string;
  senderCity?: string;
  senderArea?: string;
  senderAddress?: string;
  defaultServiceCode?: string;
  defaultWeightKg?: string;
  defaultLengthCm?: string;
  defaultWidthCm?: string;
  defaultHeightCm?: string;
  packageDescription?: string;
}

export interface TenantFedExIntegration {
  clientId?: string;
  clientSecret?: string;
  accountNumber?: string;
  baseUrl?: string;
  environment?: "test" | "prod";
  shipperName?: string;
  shipperPhone?: string;
  shipperStreet?: string;
  shipperCity?: string;
  shipperStateOrProvinceCode?: string;
  shipperPostalCode?: string;
  shipperCountryCode?: string;
  defaultServiceType?: string;
  defaultPackagingType?: string;
  defaultWeightKg?: string;
  defaultLengthCm?: string;
  defaultWidthCm?: string;
  defaultHeightCm?: string;
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

/** Meta WhatsApp Cloud API — tokens stay server-side; never return to clients. */
export interface TenantWhatsAppCloudIntegration {
  /** GET webhook verification (`hub.verify_token`). */
  verifyToken?: string;
  /** Long-lived system user token for Graph API. */
  accessToken?: string;
  /** Phone number id from Meta (messages endpoint). */
  phoneNumberId?: string;
  businessAccountId?: string;
  /** Override global `WHATSAPP_APP_SECRET` for signature validation. */
  appSecret?: string;
}

export interface TenantIntegrationsDoc {
  woocommerce?: TenantWooCommerceIntegration;
  bosta?: TenantBostaIntegration;
  jntEgypt?: TenantJntEgyptIntegration;
  fedex?: TenantFedExIntegration;
  storefrontOrders?: TenantStorefrontOrdersIntegration;
  /** سلوك المسح في المخزن (بدون واتساب). */
  warehouse?: TenantWarehouseSettings;
  /** Cloud API for inbox + automation. */
  whatsapp?: TenantWhatsAppCloudIntegration;
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
