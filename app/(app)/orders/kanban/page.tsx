"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { OrdersViewSwitch } from "@/components/orders/orders-view-switch";
import { OrdersKanbanBoard } from "@/components/orders/orders-kanban-board";
import { KanbanSkeleton } from "@/components/ui/skeleton";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import type { Order } from "@/lib/types/models";

const STATUS_BATCHES = [
  "new,pending_confirmation",
  "confirmed,invoice_required,invoiced",
  "ready_for_shipping,awb_created",
  "warehouse_picking,warehouse_packed",
  "out_for_shipping,delivered,failed_delivery",
  "returned,exchange_requested,replacement_created",
  "cancelled,closed",
];

export default function KanbanPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const permissions = useSessionStore((s) => s.permissions);
  const authReady = useSessionStore((s) => s.authReady);

  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = buildAuthHeaders({
    apiSecret,
    idToken,
    tenantId,
    userId,
    role,
  });

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const pages = await Promise.all(
          STATUS_BATCHES.map(async (status) => {
            const params = new URLSearchParams({ status, limit: "30" });
            const res = await fetch(`/api/orders?${params.toString()}`, {
              headers,
            });
            const json = (await res.json()) as {
              data?: { orders?: Order[] };
              error?: string;
            };
            if (!res.ok) throw new Error(json.error ?? res.statusText);
            return json.data?.orders ?? [];
          }),
        );
        if (!cancelled) {
          const merged = new Map<string, Order>();
          for (const list of pages) for (const o of list) merged.set(o.id, o);
          setOrders([...merged.values()]);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, apiSecret, idToken, tenantId, userId, role]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="لوحة الطلبات (شاشة كاملة)"
        description="اعرض كل المراحل جنب بعض، واسحب الكارت لتغيير الحالة."
        actions={<OrdersViewSwitch />}
      />

      {!loading && err ? (
        <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-error)]/40 bg-[color:var(--color-error)]/10 p-3 text-sm text-[color:var(--color-error)] shadow-none">
          {err}
        </p>
      ) : null}

      {loading ? (
        <KanbanSkeleton columns={6} cardsPerColumn={3} />
      ) : (
        <OrdersKanbanBoard
          orders={orders}
          subject={{ role, permissions }}
          headers={headers}
          onOrderUpdated={(next) =>
            setOrders((prev) => {
              const map = new Map(prev.map((o) => [o.id, o]));
              map.set(next.id, next);
              return [...map.values()];
            })
          }
        />
      )}
    </div>
  );
}
