import { assertTransition } from "@/lib/logic/order-state-machine";
import type { OrderStatus } from "@/lib/types/models";

const WAREHOUSE_REVERT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  ready_for_warehouse: ["invoicing"],
  packed: ["ready_for_warehouse"],
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
 * `single_fulfill` allows `ready_for_warehouse` → `shipped` in one scan (shipment only).
 * `per_step` only uses main forward FSM: ready→packed, packed→shipped.
 */
export function assertWarehouseScanTransition(
  from: OrderStatus,
  to: OrderStatus,
  mode: "per_step" | "single_fulfill",
) {
  if (mode === "single_fulfill" && from === "ready_for_warehouse" && to === "shipped")
    return;
  // packed → shipped in single_fulfill after manual packed state
  if (mode === "single_fulfill" && from === "packed" && to === "shipped")
    return;
  assertTransition(from, to);
}
