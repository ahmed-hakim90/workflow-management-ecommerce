import type { Order, OrderStatus } from "@/lib/types/models";
import {
  statusRequiresAwb,
  statusRequiresInvoice,
} from "@/lib/logic/order-status-meta";

/**
 * Forward FSM for the OMS Orders module.
 *
 * NOTE: This is the *raw* allow-list. Real-world transitions go through
 * `assertTransitionAllowed()` which adds invoice/AWB/role gates on top.
 */
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  // الطلبات الجديدة ممكن تروح للتأكيد، أو تتأكد على طول لو اليوزر قلب، أو تتلغي.
  new: ["pending_confirmation", "confirmed", "cancelled"],
  pending_confirmation: ["confirmed", "cancelled"],
  confirmed: ["invoice_required", "cancelled"],
  invoice_required: ["invoiced", "cancelled"],
  invoiced: ["ready_for_shipping", "cancelled"],
  // بعد الجاهزية لازم نعمل بوليصة (AWB) قبل ما المخزن يبدأ.
  ready_for_shipping: ["awb_created", "cancelled"],
  // ممكن نتخطى مرحلة الـ picking لو فريق المخزن مش بيستخدمها (per-step بسيط).
  awb_created: ["warehouse_picking", "warehouse_packed", "cancelled"],
  warehouse_picking: ["warehouse_packed"],
  warehouse_packed: ["out_for_shipping"],
  out_for_shipping: ["delivered", "failed_delivery"],
  // الفشل في التسليم له 4 مسارات: محاولة جديدة، إرجاع، استبدال، أو إغلاق نهائي.
  failed_delivery: [
    "out_for_shipping",
    "returned",
    "exchange_requested",
    "closed",
  ],
  delivered: ["returned", "exchange_requested", "closed"],
  returned: ["replacement_created", "closed"],
  exchange_requested: ["replacement_created", "closed"],
  // البدل بيرجع للشحن من جديد (ready_for_shipping) أو يقفل.
  replacement_created: ["ready_for_shipping", "closed"],
  cancelled: ["closed"],
  closed: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid status transition: ${from} -> ${to}`);
  }
}

/**
 * Reasons a transition can be blocked beyond the raw FSM allow-list.
 * UI layer maps these to Arabic explanations.
 */
export type TransitionBlockReason =
  | "invalid_transition"
  | "missing_invoice"
  | "missing_awb";

export class TransitionBlockedError extends Error {
  status = 422;
  constructor(
    public reason: TransitionBlockReason,
    public from: OrderStatus,
    public to: OrderStatus,
    message: string,
  ) {
    super(message);
    this.name = "TransitionBlockedError";
  }
}

/**
 * Combine FSM check + invoice gate + AWB gate.
 *
 * Role gate is enforced separately via RBAC in the orchestrator (see
 * `lib/logic/order-actions.ts` + `assertCan`); we keep this function pure
 * w.r.t. the order document so it stays unit-testable without a session.
 *
 * الـ ticket gate (returned / exchange_requested) بيتعمل في الأوركستراتور
 * لإن إنشاء التذكرة بيحصل قبل ما الحالة تتغير.
 */
export function assertTransitionAllowed(
  order: Pick<Order, "status" | "invoice" | "shipmentIds" | "latestShipmentAwb">,
  to: OrderStatus,
) {
  const from = order.status;
  if (!canTransition(from, to)) {
    throw new TransitionBlockedError(
      "invalid_transition",
      from,
      to,
      `Invalid status transition: ${from} -> ${to}`,
    );
  }
  if (statusRequiresInvoice(to) && !order.invoice?.number) {
    throw new TransitionBlockedError(
      "missing_invoice",
      from,
      to,
      "Cannot move to this status before the order is invoiced",
    );
  }
  if (statusRequiresAwb(to)) {
    const hasShipment = (order.shipmentIds?.length ?? 0) > 0;
    const hasAwb = !!order.latestShipmentAwb?.trim();
    if (!hasShipment || !hasAwb) {
      throw new TransitionBlockedError(
        "missing_awb",
        from,
        to,
        "Cannot mark warehouse-stage status before an AWB exists",
      );
    }
  }
}

/** Lookup helper used by UI components rendering drop targets. */
export function allowedNextStatuses(from: OrderStatus): OrderStatus[] {
  return [...(ALLOWED[from] ?? [])];
}
