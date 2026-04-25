import type { UserRole } from "@/lib/types/models";

export type OrderAction =
  | "order:read"
  | "order:confirm"
  | "order:invoice"
  | "order:cancel"
  | "order:assign";

export type ShipmentAction =
  | "shipment:create"
  | "shipment:scan"
  | "shipment:read";

export type TicketAction =
  | "ticket:create"
  | "ticket:read"
  | "ticket:assign"
  | "ticket:resolve";

export type UserAction = "user:read" | "user:manage";

const ROLE_MATRIX: Record<UserRole, string[]> = {
  admin: ["*"],
  moderator: [
    "order:read",
    "order:confirm",
    "order:invoice",
    "order:cancel",
    "order:assign",
    "shipment:create",
    "shipment:scan",
    "shipment:read",
    "ticket:create",
    "ticket:read",
    "ticket:assign",
    "ticket:resolve",
    "user:read",
    "user:manage",
  ],
  confirmation: ["order:read", "order:confirm", "order:assign"],
  invoicing: ["order:read", "order:invoice", "order:assign"],
  warehouse: ["order:read", "shipment:read", "shipment:scan"],
  support: [
    "order:read",
    "ticket:create",
    "ticket:read",
    "ticket:assign",
    "ticket:resolve",
    "shipment:create",
  ],
};

export function can(role: UserRole, action: string): boolean {
  const perms = ROLE_MATRIX[role];
  return perms.includes("*") || perms.includes(action);
}

export function assertCan(role: UserRole, action: string) {
  if (!can(role, action)) {
    const err = new Error("Forbidden");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}
