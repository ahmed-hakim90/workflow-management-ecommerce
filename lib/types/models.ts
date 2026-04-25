/** Order lifecycle per Hakimo OMS spec */
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
  role: UserRole;
  permissions: string[];
  daily_target: number;
  createdAt: string;
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

export type AutomationShipmentStage = "confirmed" | "invoiced";

export interface TenantAutomationSettings {
  auto_create_shipment: boolean;
  create_shipment_stage: AutomationShipmentStage;
}

export const defaultTenantAutomation: TenantAutomationSettings = {
  auto_create_shipment: false,
  create_shipment_stage: "confirmed",
};

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
