import type { UserRole } from "@/lib/types/models";

export type PagePermission =
  | "page:analytics"
  | "page:accounts"
  | "page:orders"
  | "page:shipments"
  | "page:tickets"
  | "page:warehouse"
  | "page:admin"
  | "page:users"
  | "page:settings"
  | "page:inbox";

export type InboxAction =
  | "inbox:read"
  | "inbox:write"
  | "inbox:manage"
  | "inbox:read_linked_order";

export type OrderAction =
  | "order:read"
  | "order:confirm"
  | "order:invoice"
  | "order:cancel"
  | "order:assign"
  | "order:revert"
  | "order:delete"
  | "order:request_invoice"
  | "order:mark_ready"
  | "order:warehouse_pick"
  | "order:warehouse_pack"
  | "order:dispatch"
  | "order:mark_delivered"
  | "order:mark_failed"
  | "order:return"
  | "order:exchange"
  | "order:replacement"
  | "order:close";

export type ShipmentAction =
  | "shipment:create"
  | "shipment:scan"
  | "shipment:read";

export type TicketAction =
  | "ticket:create"
  | "ticket:read"
  | "ticket:assign"
  | "ticket:resolve"
  | "ticket:delete";

export type UserAction = "user:read" | "user:manage";

export type FinanceAction = "finance:view";

export type AccountAction = "account:read" | "account:manage";

export type Permission =
  | PagePermission
  | OrderAction
  | ShipmentAction
  | TicketAction
  | UserAction
  | AccountAction
  | FinanceAction
  | InboxAction;

export type PermissionOverride = Permission | `-${Permission}`;

export type PermissionSubject =
  | UserRole
  | {
      role: UserRole;
      permissions?: string[];
    };

export const PAGE_PERMISSIONS: PagePermission[] = [
  "page:analytics",
  "page:accounts",
  "page:orders",
  "page:shipments",
  "page:tickets",
  "page:warehouse",
  "page:admin",
  "page:users",
  "page:settings",
  "page:inbox",
];

export const ACTION_PERMISSIONS: Permission[] = [
  "order:read",
  "order:confirm",
  "order:invoice",
  "order:cancel",
  "order:assign",
  "order:revert",
  "order:delete",
  "order:request_invoice",
  "order:mark_ready",
  "order:warehouse_pick",
  "order:warehouse_pack",
  "order:dispatch",
  "order:mark_delivered",
  "order:mark_failed",
  "order:return",
  "order:exchange",
  "order:replacement",
  "order:close",
  "shipment:create",
  "shipment:scan",
  "shipment:read",
  "ticket:create",
  "ticket:read",
  "ticket:assign",
  "ticket:resolve",
  "ticket:delete",
  "user:read",
  "user:manage",
  "account:read",
  "account:manage",
  "finance:view",
  "inbox:read",
  "inbox:write",
  "inbox:manage",
  "inbox:read_linked_order",
];

export const ALL_PERMISSIONS: Permission[] = [
  ...PAGE_PERMISSIONS,
  ...ACTION_PERMISSIONS,
];

const VALID_PERMISSIONS = new Set<string>(ALL_PERMISSIONS);

const ADMIN_OPERATIONAL_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(
  (p) => p !== "finance:view",
);

const ROLE_MATRIX: Record<UserRole, Permission[]> = {
  admin: ADMIN_OPERATIONAL_PERMISSIONS,
  moderator: [
    "page:analytics",
    "page:accounts",
    "page:orders",
    "page:shipments",
    "page:tickets",
    "page:warehouse",
    "page:admin",
    "page:users",
    "page:settings",
    "page:inbox",
    "inbox:read",
    "inbox:write",
    "inbox:manage",
    "order:read",
    "order:confirm",
    "order:invoice",
    "order:cancel",
    "order:assign",
    "order:revert",
    "order:request_invoice",
    "order:mark_ready",
    "order:warehouse_pick",
    "order:warehouse_pack",
    "order:dispatch",
    "order:mark_delivered",
    "order:mark_failed",
    "order:return",
    "order:exchange",
    "order:replacement",
    "order:close",
    "shipment:create",
    "shipment:scan",
    "shipment:read",
    "ticket:create",
    "ticket:read",
    "ticket:assign",
    "ticket:resolve",
    "user:read",
    "user:manage",
    "account:read",
    "account:manage",
  ],
  confirmation: [
    "page:orders",
    "page:inbox",
    "inbox:read",
    "inbox:write",
    "page:settings",
    "order:read",
    "order:confirm",
    "order:cancel",
    "order:assign",
    "order:request_invoice",
    "shipment:create",
    "shipment:read",
  ],
  invoicing: [
    "page:orders",
    "page:settings",
    "order:read",
    "order:invoice",
    "order:assign",
    "order:mark_ready",
  ],
  warehouse: [
    "page:orders",
    "page:shipments",
    "page:warehouse",
    "page:inbox",
    "inbox:read_linked_order",
    "page:settings",
    "order:read",
    "order:revert",
    "order:warehouse_pick",
    "order:warehouse_pack",
    "order:dispatch",
    "order:mark_delivered",
    "order:mark_failed",
    "shipment:create",
    "shipment:read",
    "shipment:scan",
  ],
  support: [
    "page:orders",
    "page:shipments",
    "page:tickets",
    "page:inbox",
    "inbox:read",
    "inbox:write",
    "page:settings",
    "order:read",
    "order:return",
    "order:exchange",
    "order:replacement",
    "order:mark_failed",
    "ticket:create",
    "ticket:read",
    "ticket:assign",
    "ticket:resolve",
    "shipment:create",
    "shipment:read",
  ],
  viewer: ["page:inbox", "inbox:read"],
};

export function roleDefaultPermissions(role: UserRole): Permission[] {
  return [...ROLE_MATRIX[role]];
}

function subjectRole(subject: PermissionSubject): UserRole {
  return typeof subject === "string" ? subject : subject.role;
}

function subjectOverrides(subject: PermissionSubject): string[] {
  return typeof subject === "string" ? [] : (subject.permissions ?? []);
}

export function normalizePermissionOverrides(
  permissions: string[] | undefined,
): PermissionOverride[] {
  return (permissions ?? []).filter((raw): raw is PermissionOverride => {
    const p = raw.startsWith("-") ? raw.slice(1) : raw;
    return VALID_PERMISSIONS.has(p);
  });
}

export function effectivePermissions(subject: PermissionSubject): Permission[] {
  const out = new Set<Permission>(roleDefaultPermissions(subjectRole(subject)));
  for (const raw of normalizePermissionOverrides(subjectOverrides(subject))) {
    if (raw.startsWith("-")) {
      out.delete(raw.slice(1) as Permission);
    } else {
      out.add(raw as Permission);
    }
  }
  return [...out];
}

export function can(subject: PermissionSubject, action: string): boolean {
  return effectivePermissions(subject).includes(action as Permission);
}

export function canAccessPage(
  subject: PermissionSubject,
  page: PagePermission,
): boolean {
  return can(subject, page);
}

export function assertCan(subject: PermissionSubject, action: string) {
  if (!can(subject, action)) {
    const err = new Error("Forbidden");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}
