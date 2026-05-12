import type { Order, OrderStatus } from "@/lib/types/models";
import {
  can,
  type Permission,
  type PermissionSubject,
} from "@/lib/auth/rbac";
import { allowedNextStatuses } from "@/lib/logic/order-state-machine";
import {
  statusRequiresAwb,
  statusRequiresInvoice,
  statusRequiresTicket,
} from "@/lib/logic/order-status-meta";

/**
 * Catalogue of high-level order actions. Each action maps 1:1 to a forward
 * transition (or to a no-op like delete/assign which keep the order in place).
 *
 * UI components iterate `availableActions(order, subject)` and render only
 * actions whose role + invoice + AWB gates pass for the current order.
 */
export type OrderActionId =
  | "confirm"
  | "request_invoice"
  | "issue_invoice"
  | "mark_ready_for_shipping"
  | "create_awb"
  | "start_picking"
  | "mark_packed"
  | "dispatch"
  | "mark_delivered"
  | "mark_failed"
  | "retry_shipping"
  | "open_return"
  | "open_exchange"
  | "create_replacement"
  | "close"
  | "cancel";

export interface OrderActionDef {
  id: OrderActionId;
  /** Forward target status. `null` means the action does not change the status. */
  toStatus: OrderStatus;
  label_en: string;
  label_ar: string;
  permission: Permission;
  /** Show a confirm dialog with reason/note input. */
  requiresNote?: boolean;
  /** Prompt for an invoice number (used for the issue_invoice action). */
  requiresInvoiceNumberPrompt?: boolean;
  /** When set, calling the action also creates a customer-service ticket. */
  requiresTicket?: "return" | "exchange";
  /** Visual variant for the button. */
  variant?: "primary" | "secondary" | "danger";
}

/**
 * Master action table. Status of order + role permissions determine which of
 * these are surfaced in `availableActions()`.
 */
export const ORDER_ACTIONS: OrderActionDef[] = [
  {
    id: "confirm",
    toStatus: "confirmed",
    label_en: "Confirm order",
    label_ar: "تأكيد الطلب",
    permission: "order:confirm",
    variant: "primary",
  },
  {
    id: "request_invoice",
    toStatus: "invoice_required",
    label_en: "Request invoice",
    label_ar: "طلب الفاتورة",
    permission: "order:request_invoice",
    variant: "secondary",
  },
  {
    id: "issue_invoice",
    toStatus: "invoiced",
    label_en: "Issue invoice",
    label_ar: "إصدار الفاتورة",
    permission: "order:invoice",
    requiresInvoiceNumberPrompt: true,
    variant: "primary",
  },
  {
    id: "mark_ready_for_shipping",
    toStatus: "ready_for_shipping",
    label_en: "Mark ready for shipping",
    label_ar: "تجهيز للشحن",
    permission: "order:mark_ready",
    variant: "secondary",
  },
  {
    id: "create_awb",
    toStatus: "awb_created",
    label_en: "Create AWB",
    label_ar: "إنشاء بوليصة شحن",
    permission: "shipment:create",
    variant: "primary",
  },
  {
    id: "start_picking",
    toStatus: "warehouse_picking",
    label_en: "Start picking",
    label_ar: "بدء التجهيز",
    permission: "order:warehouse_pick",
    variant: "secondary",
  },
  {
    id: "mark_packed",
    toStatus: "warehouse_packed",
    label_en: "Mark packed",
    label_ar: "تأكيد التغليف",
    permission: "order:warehouse_pack",
    variant: "primary",
  },
  {
    id: "dispatch",
    toStatus: "out_for_shipping",
    label_en: "Dispatch",
    label_ar: "تسليم لشركة الشحن",
    permission: "order:dispatch",
    variant: "primary",
  },
  {
    id: "mark_delivered",
    toStatus: "delivered",
    label_en: "Mark delivered",
    label_ar: "تأكيد التسليم",
    permission: "order:mark_delivered",
    variant: "primary",
  },
  {
    id: "mark_failed",
    toStatus: "failed_delivery",
    label_en: "Mark failed delivery",
    label_ar: "فشل التسليم",
    permission: "order:mark_failed",
    requiresNote: true,
    variant: "danger",
  },
  {
    id: "retry_shipping",
    toStatus: "out_for_shipping",
    label_en: "Retry delivery",
    label_ar: "إعادة محاولة التسليم",
    permission: "order:dispatch",
    variant: "secondary",
  },
  {
    id: "open_return",
    toStatus: "returned",
    label_en: "Open return",
    label_ar: "فتح طلب إرجاع",
    permission: "order:return",
    requiresNote: true,
    requiresTicket: "return",
    variant: "secondary",
  },
  {
    id: "open_exchange",
    toStatus: "exchange_requested",
    label_en: "Open exchange",
    label_ar: "فتح طلب استبدال",
    permission: "order:exchange",
    requiresNote: true,
    requiresTicket: "exchange",
    variant: "secondary",
  },
  {
    id: "create_replacement",
    toStatus: "replacement_created",
    label_en: "Create replacement",
    label_ar: "إنشاء بدل",
    permission: "order:replacement",
    variant: "primary",
  },
  {
    id: "close",
    toStatus: "closed",
    label_en: "Close order",
    label_ar: "إغلاق الطلب",
    permission: "order:close",
    variant: "secondary",
  },
  {
    id: "cancel",
    toStatus: "cancelled",
    label_en: "Cancel order",
    label_ar: "إلغاء الطلب",
    permission: "order:cancel",
    requiresNote: true,
    variant: "danger",
  },
];

/**
 * Return the actions a given user can currently perform on this order.
 *
 * Filters out actions whose target status isn't reachable from the current
 * status, then applies role + invoice + AWB gates. UI uses the result as-is.
 *
 * المنطق:
 * - أول حاجة: لازم الـ FSM يسمح بالتحويل من الحالة الحالية للحالة الجديدة.
 * - تاني حاجة: لازم اليوزر معاه الـ permission المطلوب.
 * - تالت حاجة: لو الحالة بعد الفاتورة، لازم الفاتورة موجودة.
 * - رابع حاجة: لو الحالة في المخزن، لازم AWB موجود فعلاً.
 */
export function availableActions(
  order: Pick<Order, "status" | "invoice" | "shipmentIds" | "latestShipmentAwb">,
  subject: PermissionSubject,
): OrderActionDef[] {
  const reachable = new Set(allowedNextStatuses(order.status));
  return ORDER_ACTIONS.filter((action) => {
    if (!reachable.has(action.toStatus)) return false;
    if (!can(subject, action.permission)) return false;
    // الإستثناء: الـ issue_invoice action هو نفسه اللي بيكتب الفاتورة، فمينفعش
    // نفلتره علشان مفيش invoice — الـ orchestrator بيكتب الـ number قبل ما
    // يتنادى الـ assertTransitionAllowed.
    if (
      statusRequiresInvoice(action.toStatus) &&
      !order.invoice?.number &&
      !action.requiresInvoiceNumberPrompt
    ) {
      return false;
    }
    if (statusRequiresAwb(action.toStatus)) {
      if (!order.shipmentIds?.length) return false;
      if (!order.latestShipmentAwb?.trim()) return false;
    }
    return true;
  });
}

/**
 * Hard guard for the action-id pathway (called from the API). Throws an Error
 * with `status` set to 403/422 when the action is not allowed.
 */
export function assertActionAllowed(
  order: Pick<Order, "status" | "invoice" | "shipmentIds" | "latestShipmentAwb">,
  actionId: OrderActionId,
  subject: PermissionSubject,
) {
  const action = ORDER_ACTIONS.find((a) => a.id === actionId);
  if (!action) {
    const e = new Error(`Unknown action: ${actionId}`) as Error & {
      status: number;
    };
    e.status = 400;
    throw e;
  }
  if (!availableActions(order, subject).some((a) => a.id === actionId)) {
    const e = new Error(`Action ${actionId} not allowed for this order`) as Error & {
      status: number;
    };
    e.status = 403;
    throw e;
  }
}

/** Convenience accessor used by tests + UI. */
export function actionById(actionId: OrderActionId): OrderActionDef | undefined {
  return ORDER_ACTIONS.find((a) => a.id === actionId);
}

/** Convenience accessor for forward transition triggers (returned/exchange). */
export function ticketTypeForStatus(
  status: OrderStatus,
): "return" | "exchange" | null {
  return statusRequiresTicket(status);
}
