import type {
  KanbanColumnConfig,
  OrderStatus,
  TenantKanbanSettings,
} from "@/lib/types/models";

/**
 * Default column layout for the new 17-status pipeline.
 *
 * Logical groupings (buckets) per `lib/logic/order-status-meta.ts`:
 *  - intake/confirmation → "بانتظار التأكيد"
 *  - invoicing → "الفاتورة"
 *  - shipping_prep → "تجهيز الشحن"
 *  - warehouse → "المخزن"
 *  - in_transit → "خرج للشحن"
 *  - delivered → "تم التسليم"
 *  - returns → "الإرجاع/الاستبدال"
 *  - cancelled/closed → "ملغي/مغلق"
 */
export function defaultKanbanSettings(): TenantKanbanSettings {
  return {
    columns: [
      {
        id: "confirmation",
        title: "بانتظار التأكيد",
        statuses: ["new", "pending_confirmation"],
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
        title: "الفاتورة",
        statuses: ["invoice_required", "invoiced"],
        cardFields: ["customer", "total", "payment", "woo"],
      },
      {
        id: "shipping_prep",
        title: "تجهيز الشحن",
        statuses: ["ready_for_shipping", "awb_created"],
        cardFields: ["customer", "total", "payment", "status"],
      },
      {
        id: "warehouse",
        title: "المخزن",
        statuses: ["warehouse_picking", "warehouse_packed"],
        cardFields: ["customer", "total", "payment", "status"],
      },
      {
        id: "in_transit",
        title: "خرج للشحن",
        statuses: ["out_for_shipping", "failed_delivery"],
        cardFields: ["customer", "total", "payment", "status"],
      },
      {
        id: "delivered",
        title: "تم التسليم",
        statuses: ["delivered"],
        cardFields: ["customer", "total", "payment", "status"],
      },
      {
        id: "returns",
        title: "الإرجاع / الاستبدال",
        statuses: ["returned", "exchange_requested", "replacement_created"],
        cardFields: ["customer", "total", "status"],
      },
      {
        id: "closed",
        title: "ملغي / مغلق",
        statuses: ["cancelled", "closed"],
        cardFields: ["customer", "total", "status"],
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
  return settings.columns[0]?.id ?? "confirmation";
}

export function ordersInColumn(
  orders: { status: OrderStatus }[],
  col: KanbanColumnConfig,
) {
  return orders.filter((o) => col.statuses.includes(o.status));
}
