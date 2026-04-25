import type { OrderStatus } from "@/lib/types/models";

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  pending_confirmation: ["confirmed", "cancelled"],
  confirmed: ["invoicing", "cancelled"],
  invoicing: ["ready_for_warehouse", "cancelled"],
  ready_for_warehouse: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: ["follow_up", "cancelled"],
  follow_up: ["cancelled"],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid status transition: ${from} -> ${to}`);
  }
}
