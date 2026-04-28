"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Eye, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveKanban } from "@/components/responsive/ResponsiveKanban";
import { OrdersViewSwitch } from "@/components/orders/orders-view-switch";
import { KanbanSkeleton } from "@/components/ui/skeleton";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { useUiStore } from "@/store/zustand/ui-store";
import type { Order, OrderStatus } from "@/lib/types/models";
import { OrderStatusBadge, PaymentBadge } from "@/lib/ui/order-badges";
import { can } from "@/lib/auth/rbac";

type ColumnId =
  | "pending_confirmation"
  | "confirmed"
  | "invoicing"
  | "warehouse"
  | "shipped";

const COLUMNS: { id: ColumnId; title: string }[] = [
  { id: "pending_confirmation", title: "Pending confirmation" },
  { id: "confirmed", title: "Confirmed" },
  { id: "invoicing", title: "Invoicing" },
  { id: "warehouse", title: "Warehouse" },
  { id: "shipped", title: "Shipped" },
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

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function KanbanPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const permissions = useSessionStore((s) => s.permissions);
  const authReady = useSessionStore((s) => s.authReady);
  const openDrawer = useUiStore((s) => s.openDrawer);

  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const canViewFinance = can({ role, permissions }, "finance:view");

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const res = await fetch("/api/orders", {
          headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        if (!cancelled) setOrders(json.data as Order[]);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, apiSecret, idToken, tenantId, userId, role]);

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
        title="Order board"
        description="Fulfillment stages as columns on wide screens; stacked flow on mobile."
        actions={<OrdersViewSwitch />}
      />

      {!loading && err ? (
        <p className="rounded-lg border border-[color:var(--color-error)]/40 bg-[color:var(--color-error)]/10 p-3 text-sm text-[color:var(--color-error)]">
          {err}
        </p>
      ) : null}

      {loading ? (
        <KanbanSkeleton columns={5} cardsPerColumn={3} />
      ) : (
      <ResponsiveKanban
        columns={COLUMNS}
        countFor={(id) => grouped[id].length}
        renderColumnCards={(columnId) =>
          grouped[columnId].map((o) => {
            const wooOrderId = o.wooCommerceOrderId?.trim();
            const wooOrderUrl = o.wooCommerceOrderAdminUrl?.trim();
            const whatsappSentAt = o.whatsappSentAt?.trim();
            const whatsappUser =
              o.whatsappSentByUserName?.trim() ||
              o.whatsappSentByUserId?.trim();

            return (
            <Card key={o.id}>
              <CardContent className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1">
                    <Link
                      href={`/orders/${o.id}`}
                      className="truncate font-mono text-[11px] font-semibold text-[color:var(--color-primary)] hover:underline"
                    >
                      #{wooOrderId || `${o.id.slice(0, 10)}...`}
                    </Link>
                    {wooOrderUrl ? (
                      <a
                        href={wooOrderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center text-[color:var(--color-primary)] hover:text-[color:var(--color-text-primary)]"
                        title="Open in WooCommerce"
                        aria-label={`Open WooCommerce order ${wooOrderId}`}
                      >
                        <ExternalLink className="size-3 shrink-0" aria-hidden />
                      </a>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 md:h-8"
                    aria-label="View order"
                    onClick={() =>
                      openDrawer("Order summary", () => (
                        <div className="space-y-3 text-sm">
                          <div className="font-mono text-xs break-all">
                            {o.id}
                          </div>
                          <div>{o.customer.name}</div>
                          {canViewFinance ? (
                            <div className="text-lg font-semibold">
                              {o.payment.total_amount}
                            </div>
                          ) : null}
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
                  {whatsappSentAt ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-success)]/12 px-2 py-0.5 text-[11px] font-medium text-[color:var(--color-success)]"
                      title={`WhatsApp sent${whatsappUser ? ` by ${whatsappUser}` : ""} at ${formatWhen(whatsappSentAt)}`}
                    >
                      <MessageCircle className="size-3" aria-hidden />
                      واتساب تم
                      {whatsappUser ? ` · ${whatsappUser}` : ""}
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
          })
        }
      />
      )}
    </div>
  );
}
