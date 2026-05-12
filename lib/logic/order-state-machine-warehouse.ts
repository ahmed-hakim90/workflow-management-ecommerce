import { assertTransition } from "@/lib/logic/order-state-machine";
import type { OrderStatus } from "@/lib/types/models";

/**
 * استثناءات الرجوع خطوة في فلو المخزن.
 * مش جزء من الـ FSM الأمامي علشان نحافظ على نقاء التحويلات الأمامية.
 */
const WAREHOUSE_REVERT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  awb_created: ["ready_for_shipping"],
  warehouse_picking: ["awb_created"],
  warehouse_packed: ["awb_created", "warehouse_picking"],
};

/**
 * Revert order one step backward (warehouse return); not part of main forward FSM.
 */
export function canWarehouseRevert(from: OrderStatus, to: OrderStatus): boolean {
  return WAREHOUSE_REVERT[from]?.includes(to) ?? false;
}

export function assertWarehouseRevert(from: OrderStatus, to: OrderStatus) {
  if (!canWarehouseRevert(from, to)) {
    const err = new Error(`Invalid warehouse revert: ${from} -> ${to}`) as Error & {
      status: number;
    };
    err.status = 400;
    throw err;
  }
}

/**
 * Single-scan vs per-step warehouse fulfilment.
 *
 * `single_fulfill` (الإعداد المختصر) — مسحة واحدة من awb_created → out_for_shipping.
 * `per_step` (الافتراضي) — مسحة 1: awb_created → warehouse_packed، مسحة 2: warehouse_packed → out_for_shipping.
 *
 * NOTE: warehouse_picking مرحلة اختيارية بيدخلها الموظف يدوياً من واجهة الـ "Start picking"
 * عشان نتفادى تعقيد الـ scan flow بدون فايدة.
 */
export function assertWarehouseScanTransition(
  from: OrderStatus,
  to: OrderStatus,
  mode: "per_step" | "single_fulfill",
) {
  if (mode === "single_fulfill" && from === "awb_created" && to === "out_for_shipping")
    return;
  if (
    mode === "single_fulfill" &&
    from === "warehouse_packed" &&
    to === "out_for_shipping"
  )
    return;
  assertTransition(from, to);
}
