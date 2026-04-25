"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveKanban } from "@/components/responsive/ResponsiveKanban";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { useUiStore } from "@/store/zustand/ui-store";
import type { Order, OrderStatus } from "@/lib/types/models";
import { OrderStatusBadge, PaymentBadge } from "@/lib/ui/order-badges";

type ColumnId =
  | "pending_confirmation"
  | "confirmed"
  | "invoicing"
  | "warehouse"
  | "shipped";

const COLUMNS: { id: ColumnId; title: string }[] = [
  { id: "pending_confirmation", title: "بانتظار التأكيد" },
  { id: "confirmed", title: "مؤكد" },
  { id: "invoicing", title: "فوترة" },
  { id: "warehouse", title: "المخزن" },
  { id: "shipped", title: "تم الشحن" },
];

function columnForStatus(status: OrderStatus): ColumnId {
  if (status === "pending_confirmation") return "pending_confirmation";
  if (status === "confirmed") return "confirmed";
  if (status === "invoicing") return "invoicing";
  if (status === "ready_for_warehouse" || status === "packed") {
    return "warehouse";
  }
  if (
    status === "shipped" ||
    status === "delivered" ||
    status === "follow_up"
  ) {
    return "shipped";
  }
  if (status === "cancelled") return "pending_confirmation";
  return "pending_confirmation";
}

export default function KanbanPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const openDrawer = useUiStore((s) => s.openDrawer);

  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        const res = await fetch("/api/orders", {
          headers: buildAuthHeaders({ apiSecret, tenantId, userId, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        if (!cancelled) setOrders(json.data as Order[]);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiSecret, tenantId, userId, role]);

  const grouped = useMemo(() => {
    const map: Record<ColumnId, Order[]> = {
      pending_confirmation: [],
      confirmed: [],
      invoicing: [],
      warehouse: [],
      shipped: [],
    };
    for (const o of orders) {
      map[columnForStatus(o.status)].push(o);
    }
    return map;
  }, [orders]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kanban الطلبات"
        description="أعمدة أفقية على الشاشات الواسعة، وقائمة عمودية على الجوال."
      />

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </p>
      ) : null}

      <ResponsiveKanban
        columns={COLUMNS}
        countFor={(id) => grouped[id].length}
        renderColumnCards={(columnId) =>
          grouped[columnId].map((o) => (
            <Card key={o.id}>
              <CardContent className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[11px] text-[color:var(--color-text-muted)]">
                    {o.id.slice(0, 10)}…
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 md:h-8"
                    aria-label="عرض"
                    onClick={() =>
                      openDrawer("ملخص الطلب", () => (
                        <div className="space-y-3 text-sm">
                          <div className="font-mono text-xs break-all">
                            {o.id}
                          </div>
                          <div>{o.customer.name}</div>
                          <div className="text-lg font-semibold">
                            {o.payment.total_amount}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <PaymentBadge
                              status={o.payment.payment_status}
                            />
                            <OrderStatusBadge status={o.status} />
                          </div>
                        </div>
                      ))
                    }
                  >
                    <Eye className="size-4" />
                  </Button>
                </div>
                <div className="font-medium text-[color:var(--color-text-primary)]">
                  {o.customer.name}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PaymentBadge status={o.payment.payment_status} />
                </div>
              </CardContent>
            </Card>
          ))
        }
      />
    </div>
  );
}
