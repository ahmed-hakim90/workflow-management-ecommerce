import type { OrderStatus, UserRole } from "@/lib/types/models";

/**
 * Pipeline bucket — الكروب الرئيسي اللي بيتعرض في الـ Kanban و التحليلات.
 * كل status بينتمي لبكت واحد بس.
 */
export type OrderStatusBucket =
  | "intake"
  | "confirmation"
  | "invoicing"
  | "shipping_prep"
  | "warehouse"
  | "in_transit"
  | "delivered"
  | "returns"
  | "closed"
  | "cancelled";

export type OrderStatusTone =
  | "default"
  | "info"
  | "warning"
  | "success"
  | "danger";

export interface OrderStatusMetaEntry {
  /** Code-name. Stays English everywhere in source. */
  status: OrderStatus;
  label_en: string;
  /** Arabic display label (Modern Standard / commercial Arabic, MSA-leaning). */
  label_ar: string;
  /** UI badge tone. */
  tone: OrderStatusTone;
  /** Pipeline bucket — used by Kanban defaults + dashboard rollups. */
  bucket: OrderStatusBucket;
  /**
   * Roles that may move an order INTO this status (forward transition).
   * Used purely as an advisory list for the UI; the actual gate lives in
   * `order-actions.ts` + RBAC permissions per action.
   */
  allowedRoles: UserRole[];
  /** Terminal states cannot be transitioned out of (except via revert flows). */
  terminal?: boolean;
  /** True if status comes after invoice has been issued. */
  postInvoice?: boolean;
}

/**
 * Single source of truth for status metadata. New statuses should be added here
 * AND in `lib/logic/order-state-machine.ts` (FSM) AND `lib/i18n/dictionaries.ts`.
 */
export const ORDER_STATUS_META: Record<OrderStatus, OrderStatusMetaEntry> = {
  new: {
    status: "new",
    label_en: "New",
    label_ar: "جديد",
    tone: "info",
    bucket: "intake",
    allowedRoles: ["admin", "moderator", "confirmation"],
  },
  pending_confirmation: {
    status: "pending_confirmation",
    label_en: "Pending confirmation",
    label_ar: "بانتظار التأكيد",
    tone: "warning",
    bucket: "confirmation",
    allowedRoles: ["admin", "moderator", "confirmation"],
  },
  confirmed: {
    status: "confirmed",
    label_en: "Confirmed",
    label_ar: "مؤكد",
    tone: "info",
    bucket: "confirmation",
    allowedRoles: ["admin", "moderator", "confirmation"],
  },
  cancelled: {
    status: "cancelled",
    label_en: "Cancelled",
    label_ar: "ملغي",
    tone: "danger",
    bucket: "cancelled",
    allowedRoles: ["admin", "moderator", "confirmation", "support"],
  },
  invoice_required: {
    status: "invoice_required",
    label_en: "Invoice required",
    label_ar: "بانتظار الفاتورة",
    tone: "warning",
    bucket: "invoicing",
    allowedRoles: ["admin", "moderator", "confirmation"],
  },
  invoiced: {
    status: "invoiced",
    label_en: "Invoiced",
    label_ar: "تمت الفوترة",
    tone: "info",
    bucket: "invoicing",
    allowedRoles: ["admin", "moderator", "invoicing"],
    postInvoice: true,
  },
  ready_for_shipping: {
    status: "ready_for_shipping",
    label_en: "Ready for shipping",
    label_ar: "جاهز للشحن",
    tone: "info",
    bucket: "shipping_prep",
    allowedRoles: ["admin", "moderator", "invoicing", "warehouse"],
    postInvoice: true,
  },
  awb_created: {
    status: "awb_created",
    label_en: "AWB created",
    label_ar: "تم إنشاء بوليصة الشحن",
    tone: "info",
    bucket: "shipping_prep",
    allowedRoles: ["admin", "moderator", "warehouse"],
    postInvoice: true,
  },
  warehouse_picking: {
    status: "warehouse_picking",
    label_en: "Warehouse picking",
    label_ar: "جاري التجهيز في المخزن",
    tone: "warning",
    bucket: "warehouse",
    allowedRoles: ["admin", "moderator", "warehouse"],
    postInvoice: true,
  },
  warehouse_packed: {
    status: "warehouse_packed",
    label_en: "Warehouse packed",
    label_ar: "تم التغليف",
    tone: "info",
    bucket: "warehouse",
    allowedRoles: ["admin", "moderator", "warehouse"],
    postInvoice: true,
  },
  out_for_shipping: {
    status: "out_for_shipping",
    label_en: "Out for shipping",
    label_ar: "خرج للشحن",
    tone: "success",
    bucket: "in_transit",
    allowedRoles: ["admin", "moderator", "warehouse"],
    postInvoice: true,
  },
  delivered: {
    status: "delivered",
    label_en: "Delivered",
    label_ar: "تم التسليم",
    tone: "success",
    bucket: "delivered",
    allowedRoles: ["admin", "moderator", "warehouse", "support"],
    postInvoice: true,
  },
  failed_delivery: {
    status: "failed_delivery",
    label_en: "Failed delivery",
    label_ar: "فشل التسليم",
    tone: "danger",
    bucket: "in_transit",
    allowedRoles: ["admin", "moderator", "warehouse", "support"],
    postInvoice: true,
  },
  returned: {
    status: "returned",
    label_en: "Returned",
    label_ar: "تم الإرجاع",
    tone: "warning",
    bucket: "returns",
    allowedRoles: ["admin", "moderator", "support", "warehouse"],
    postInvoice: true,
  },
  exchange_requested: {
    status: "exchange_requested",
    label_en: "Exchange requested",
    label_ar: "طلب استبدال",
    tone: "warning",
    bucket: "returns",
    allowedRoles: ["admin", "moderator", "support"],
    postInvoice: true,
  },
  replacement_created: {
    status: "replacement_created",
    label_en: "Replacement created",
    label_ar: "تم إنشاء بدل",
    tone: "info",
    bucket: "returns",
    allowedRoles: ["admin", "moderator", "support", "warehouse"],
    postInvoice: true,
  },
  closed: {
    status: "closed",
    label_en: "Closed",
    label_ar: "مغلق",
    tone: "default",
    bucket: "closed",
    allowedRoles: ["admin", "moderator"],
    terminal: true,
  },
};

export function statusMeta(status: OrderStatus): OrderStatusMetaEntry {
  return ORDER_STATUS_META[status];
}

export function statusLabel(
  status: OrderStatus,
  locale: "en" | "ar" = "ar",
): string {
  const meta = ORDER_STATUS_META[status];
  return locale === "ar" ? meta.label_ar : meta.label_en;
}

/** All statuses grouped by pipeline bucket — useful for Kanban defaults. */
export function statusesByBucket(): Record<OrderStatusBucket, OrderStatus[]> {
  const out = {
    intake: [],
    confirmation: [],
    invoicing: [],
    shipping_prep: [],
    warehouse: [],
    in_transit: [],
    delivered: [],
    returns: [],
    closed: [],
    cancelled: [],
  } as Record<OrderStatusBucket, OrderStatus[]>;
  for (const meta of Object.values(ORDER_STATUS_META)) {
    out[meta.bucket].push(meta.status);
  }
  return out;
}

/** True if reaching `status` requires an invoice on the order. */
export function statusRequiresInvoice(status: OrderStatus): boolean {
  return ORDER_STATUS_META[status].postInvoice === true;
}

/**
 * Statuses that need an AWB (shipment) to exist on the order before transitioning in.
 * أي حالة بعد إنشاء البوليصة لازم يكون فيه AWB موجود فعلاً.
 */
export function statusRequiresAwb(status: OrderStatus): boolean {
  return (
    status === "warehouse_picking" ||
    status === "warehouse_packed" ||
    status === "out_for_shipping" ||
    status === "delivered" ||
    status === "failed_delivery"
  );
}

/** Statuses that auto-create a customer-service ticket when entered. */
export function statusRequiresTicket(
  status: OrderStatus,
): "return" | "exchange" | null {
  if (status === "returned") return "return";
  if (status === "exchange_requested") return "exchange";
  return null;
}
