import type {
  KanbanColumnConfig,
  OrderStatus,
  TenantKanbanSettings,
} from "@/lib/types/models";

export function defaultKanbanSettings(): TenantKanbanSettings {
  return {
    columns: [
      {
        id: "pending_confirmation",
        title: "بانتظار التأكيد",
        statuses: ["pending_confirmation", "cancelled"],
        cardFields: ["customer", "total", "payment", "assigned"],
      },
      {
        id: "confirmed",
        title: "مؤكد",
        statuses: ["confirmed"],
        cardFields: ["customer", "total", "payment", "assigned"],
      },
      {
        id: "invoicing",
        title: "فوترة",
        statuses: ["invoicing"],
        cardFields: ["customer", "total", "payment", "woo"],
      },
      {
        id: "warehouse",
        title: "المخزن",
        statuses: ["ready_for_warehouse", "packed"],
        cardFields: ["customer", "total", "payment", "status"],
      },
      {
        id: "shipped",
        title: "تم الشحن",
        statuses: ["shipped", "delivered", "follow_up"],
        cardFields: ["customer", "total", "payment", "status"],
      },
    ],
  };
}

export function mergeKanbanSettings(
  partial?: TenantKanbanSettings | null,
): TenantKanbanSettings {
  const base = defaultKanbanSettings();
  if (!partial?.columns?.length) return base;
  const cols = partial.columns.filter(
    (c) => c.id?.trim() && Array.isArray(c.statuses) && c.statuses.length > 0,
  );
  if (!cols.length) return base;
  return { columns: cols };
}

export function columnIdForStatus(
  status: OrderStatus,
  settings: TenantKanbanSettings,
): string {
  for (const c of settings.columns) {
    if (c.statuses.includes(status)) return c.id;
  }
  return settings.columns[0]?.id ?? "pending_confirmation";
}

export function ordersInColumn(
  orders: { status: OrderStatus }[],
  col: KanbanColumnConfig,
) {
  return orders.filter((o) => col.statuses.includes(o.status));
}
