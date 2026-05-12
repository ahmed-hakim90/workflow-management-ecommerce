"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Download,
  ExternalLink,
  Maximize2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RotateCcw,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { TableWrap, Th, Tr, Td } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { ResponsiveCard } from "@/components/responsive/ResponsiveCard";
import { OrderCardListSkeleton, Skeleton } from "@/components/ui/skeleton";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { useUiStore } from "@/store/zustand/ui-store";
import type {
  Order,
  OrderStatus,
  PaymentStatus,
  ShipmentStatus,
  User,
} from "@/lib/types/models";
import { OrderStatusBadge, PaymentBadge } from "@/lib/ui/order-badges";
import { OrdersKanbanBoard } from "@/components/orders/orders-kanban-board";
import { statusLabel, statusesByBucket } from "@/lib/logic/order-status-meta";
import {
  arrangeOrdersByDuplicatePhoneClusters,
  duplicatePhoneCounts,
  duplicatePhoneGroupSize,
  isDuplicateCustomerPhone,
} from "@/lib/ui/order-phone-grouping";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/ui/cn";
import { OrdersViewSwitch } from "@/components/orders/orders-view-switch";
import { OrderPeekPanel } from "@/components/orders/order-peek-panel";
import { can } from "@/lib/auth/rbac";

const PAGE_SIZE = 10;
const PAYMENTS: (PaymentStatus | "")[] = ["", "paid", "unpaid", "partial", "cod"];
const SHIPMENT_STATUSES: (ShipmentStatus | "")[] = [
  "",
  "pending",
  "created",
  "packed",
  "shipped",
  "delivered",
  "failed",
  "cancelled",
];

type QuickTab =
  | "all"
  | "intake"
  | "confirmation"
  | "invoicing"
  | "shipping_prep"
  | "warehouse"
  | "in_transit"
  | "delivered"
  | "returns"
  | "cancelled";
type DatePreset = "today" | "yesterday" | "custom";

type OrdersSummaryPayload = {
  stages: Record<string, number>;
};

type OrdersFinancialPayload = {
  totals: {
    orders_value: number;
  };
};

const QUICK_TABS: { id: QuickTab; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "intake", label: "وارد" },
  { id: "confirmation", label: "بانتظار التأكيد" },
  { id: "invoicing", label: "الفاتورة" },
  { id: "shipping_prep", label: "تجهيز الشحن" },
  { id: "warehouse", label: "المخزن" },
  { id: "in_transit", label: "خرج للشحن" },
  { id: "delivered", label: "تم التسليم" },
  { id: "returns", label: "الإرجاع/الاستبدال" },
  { id: "cancelled", label: "ملغي" },
];

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function displayOrderId(order: Order) {
  return order.wooCommerceOrderId?.trim() || order.id.slice(0, 8).toUpperCase();
}

function statusesForQuickTab(tab: QuickTab): OrderStatus[] {
  if (tab === "all") return [];
  const buckets = statusesByBucket();
  switch (tab) {
    case "intake":
      return buckets.intake;
    case "confirmation":
      return buckets.confirmation;
    case "invoicing":
      return buckets.invoicing;
    case "shipping_prep":
      return buckets.shipping_prep;
    case "warehouse":
      return buckets.warehouse;
    case "in_transit":
      return buckets.in_transit;
    case "delivered":
      return buckets.delivered;
    case "returns":
      return buckets.returns;
    case "cancelled":
      return [...buckets.cancelled, ...buckets.closed];
    default:
      return [];
  }
}

function orderIsInsideDateRange(order: Order, fromDate: string, toDate: string) {
  const createdTime = new Date(order.createdAt).getTime();
  if (!Number.isFinite(createdTime)) return true;
  if (fromDate) {
    const fromTime = new Date(`${fromDate}T00:00:00.000Z`).getTime();
    if (createdTime < fromTime) return false;
  }
  if (toDate) {
    const toTime = new Date(`${toDate}T23:59:59.999Z`).getTime();
    if (createdTime > toTime) return false;
  }
  return true;
}

function sortOrdersNewestFirst(rows: Order[]) {
  return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function upsertOrder(rows: Order[], order: Order) {
  return sortOrdersNewestFirst([
    order,
    ...rows.filter((existing) => existing.id !== order.id),
  ]);
}

async function fetchOrderForList(
  orderId: string,
  headers: Record<string, string>,
) {
  const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
    headers,
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { order?: Order };
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json.data?.order ?? null;
}

export default function OrdersPage() {
  const pathname = usePathname();
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const permissions = useSessionStore((s) => s.permissions);
  const authReady = useSessionStore((s) => s.authReady);
  const openDrawer = useUiStore((s) => s.openDrawer);
  const drawerOpen = useUiStore((s) => s.drawerOpen);

  const [orders, setOrders] = useState<Order[]>([]);
  const [sidePeekOrderId, setSidePeekOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [payment, setPayment] = useState<PaymentStatus | "">("");
  const [shippingFilter, setShippingFilter] = useState<ShipmentStatus | "">("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [statusPills, setStatusPills] = useState<OrderStatus[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showKanban, setShowKanban] = useState(true);
  const [page, setPage] = useState(0);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageInfo, setPageInfo] = useState<{
    nextCursor: string | null;
    hasMore: boolean;
  }>({ nextCursor: null, hasMore: false });
  const [quickTab, setQuickTab] = useState<QuickTab>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("custom");
  const [fromDate, setFromDate] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() - 30);
    return t.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [pendingTickets, setPendingTickets] = useState<number | null>(null);
  const [ordersSummary, setOrdersSummary] = useState<OrdersSummaryPayload | null>(
    null,
  );
  const [ordersFinancial, setOrdersFinancial] =
    useState<OrdersFinancialPayload | null>(null);
  const canViewFinance = can({ role, permissions }, "finance:view");
  const canViewAdminSummary =
    can({ role, permissions }, "page:admin") &&
    can({ role, permissions }, "user:read");
  const currentCursor = cursorStack[page] ?? null;

  const headers = useMemo(
    () => buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
    [apiSecret, idToken, tenantId, userId, role],
  );

  useEffect(() => {
    if (!drawerOpen) setSidePeekOrderId(null);
  }, [drawerOpen]);

  useEffect(() => {
    setPage(0);
    setCursorStack([null]);
  }, [
    q,
    payment,
    quickTab,
    fromDate,
    toDate,
    shippingFilter,
    assignedTo,
    statusPills.join(","),
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#app-page-filters") return;
    const id = window.requestAnimationFrame(() => {
      document
        .getElementById("app-page-filters")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    let pollingTimer: number | undefined;
    const headers = buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role });
    const listenerSince = new Date().toISOString();
    const tabStatuses = statusesForQuickTab(quickTab);
    const effectiveStatuses = statusPills.length
      ? statusPills
      : tabStatuses;

    const orderMatchesCurrentFilters = (order: Order) => {
      if (!orderIsInsideDateRange(order, fromDate, toDate)) return false;
      if (
        effectiveStatuses.length > 0 &&
        !effectiveStatuses.includes(order.status)
      ) {
        return false;
      }
      if (payment && order.payment.payment_status !== payment) return false;
      if (shippingFilter && order.latestShipmentStatus !== shippingFilter) {
        return false;
      }
      if (assignedTo && order.assigned_to !== assignedTo) return false;
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return [
        order.id,
        order.wooCommerceOrderId,
        order.customer.phone,
        order.customer.email,
        order.customer.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    };

    const mergeChangedOrder = async (orderId: string, rawOrder?: Order) => {
      if (rawOrder && !orderMatchesCurrentFilters(rawOrder)) {
        setOrders((prev) => prev.filter((order) => order.id !== orderId));
        return;
      }
      try {
        const order = await fetchOrderForList(orderId, headers);
        if (cancelled || !order) return;
        setOrders((prev) =>
          orderMatchesCurrentFilters(order)
            ? upsertOrder(prev, order)
            : prev.filter((existing) => existing.id !== order.id),
        );
      } catch {
        /* Keep the current row; the next polling cycle can retry this one-order refresh. */
      }
    };

    const startRealtimeUpdates = () => {
      if (!idToken?.trim()) return;
      pollingTimer = window.setInterval(() => {
        try {
          void fetch("/api/orders/recent?limit=20", { headers })
            .then((res) => (res.ok ? res.json() : null))
            .then((json: { data?: { orders?: Order[] } } | null) => {
              if (cancelled) return;
              for (const rawOrder of json?.data?.orders ?? []) {
                if (rawOrder.tenantId !== tenantId) continue;
                if (rawOrder.updatedAt <= listenerSince) continue;
                void mergeChangedOrder(rawOrder.id, rawOrder);
              }
            });
        } catch {
          /* polling is best-effort; the next interval can retry */
        }
      }, 10000);
    };

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams();
        if (fromDate) params.set("from", fromDate);
        if (toDate) params.set("to", toDate);
        if (effectiveStatuses.length > 0) {
          params.set("status", effectiveStatuses.join(","));
        }
        if (payment) params.set("payment", payment);
        if (shippingFilter) params.set("shipping", shippingFilter);
        if (assignedTo) params.set("assignedTo", assignedTo);
        if (q.trim()) params.set("q", q.trim());
        if (currentCursor) params.set("cursor", currentCursor);
        params.set("limit", String(PAGE_SIZE));
        const res = await fetch(`/api/orders?${params.toString()}`, {
          headers,
        });
        const json = (await res.json()) as {
          data?: {
            orders?: Order[];
            pageInfo?: { nextCursor: string | null; hasMore: boolean };
          };
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        if (!cancelled) {
          const nextInfo = json.data?.pageInfo ?? {
            nextCursor: null,
            hasMore: false,
          };
          setOrders(json.data?.orders ?? []);
          setPageInfo(nextInfo);
          if (nextInfo.nextCursor) {
            setCursorStack((prev) => {
              const next = prev.slice(0, page + 1);
              next[page + 1] = nextInfo.nextCursor;
              return next;
            });
          }
          startRealtimeUpdates();
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (pollingTimer) window.clearInterval(pollingTimer);
    };
  }, [
    authReady,
    apiSecret,
    idToken,
    tenantId,
    userId,
    role,
    fromDate,
    toDate,
    quickTab,
    payment,
    shippingFilter,
    assignedTo,
    statusPills.join(","),
    q,
    page,
    currentCursor,
  ]);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    fetch("/api/users", {
      headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const list = (j?.data ?? []) as User[];
        setUsers(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, apiSecret, idToken, tenantId, userId, role]);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    fetch("/api/tickets?status=open", {
      headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j.data) return;
        const list = j.data as { status: string }[];
        setPendingTickets(list.length);
      })
      .catch(() => {
        if (!cancelled) setPendingTickets(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, apiSecret, idToken, tenantId, userId, role]);

  useEffect(() => {
    if (!authReady || !canViewAdminSummary) {
      setOrdersSummary(null);
      return;
    }
    let cancelled = false;
    fetch("/api/admin/summary", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: OrdersSummaryPayload } | null) => {
        if (!cancelled) setOrdersSummary(j?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setOrdersSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, canViewAdminSummary, headers]);

  useEffect(() => {
    if (!authReady || !canViewFinance) {
      setOrdersFinancial(null);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    fetch(`/api/analytics?${params.toString()}`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: OrdersFinancialPayload } | null) => {
        if (!cancelled) setOrdersFinancial(j?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setOrdersFinancial(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, canViewFinance, fromDate, toDate, headers]);

  const counts = useMemo(() => {
    const result: Partial<Record<QuickTab, number>> = { all: orders.length };
    for (const tab of QUICK_TABS) {
      if (tab.id === "all") continue;
      const set = new Set(statusesForQuickTab(tab.id));
      result[tab.id] = orders.filter((o) => set.has(o.status)).length;
    }
    return result;
  }, [orders]);

  const phoneDupCounts = useMemo(() => duplicatePhoneCounts(orders), [orders]);
  const displayRows = useMemo(
    () => arrangeOrdersByDuplicatePhoneClusters(orders),
    [orders],
  );

  const filtered = orders;
  const currentPage = page;
  const pageRows = displayRows;
  const showingFrom = orders.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = page * PAGE_SIZE + orders.length;

  function resetFilters() {
    setQ("");
    setPayment("");
    setShippingFilter("");
    setAssignedTo("");
    setStatusPills([]);
    setQuickTab("all");
    setDatePreset("custom");
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - 30);
    setFromDate(f.toISOString().slice(0, 10));
    setToDate(t.toISOString().slice(0, 10));
    setPage(0);
  }

  function toggleStatusPill(status: OrderStatus) {
    setStatusPills((cur) =>
      cur.includes(status) ? cur.filter((s) => s !== status) : [...cur, status],
    );
  }

  function exportCsv() {
    const rows = arrangeOrdersByDuplicatePhoneClusters(filtered).map((o) => ({
      id: o.id,
      status: o.status,
      customer: o.customer.name,
      phone: o.customer.phone ?? "",
      ...(canViewFinance ? { total: o.payment.total_amount } : {}),
      payment: o.payment.payment_status,
    }));
    const header = Object.keys(rows[0] ?? { id: "", status: "" }).join(",");
    const body = rows
      .map((r) => Object.values(r).map((v) => `"${String(v)}"`).join(","))
      .join("\n");
    const csv = rows.length ? `${header}\n${body}` : "id,status\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${tenantId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openOrderPeek(o: Order) {
    setSidePeekOrderId(o.id);
    openDrawer(
      `Order #${displayOrderId(o)}`,
      () => (
        <OrderPeekPanel
          initial={o}
          headers={headers}
          canViewFinance={canViewFinance}
        />
      ),
      {
        panelClassName: "md:max-w-[min(600px,46vw)] lg:max-w-[640px]",
        contentClassName: "p-0",
      },
    );
  }

  const activeOrders = useMemo(
    () => {
      if (ordersSummary?.stages) {
        return Object.entries(ordersSummary.stages)
          .filter(([stage]) => stage !== "warehouse")
          .reduce((sum, [, count]) => sum + (Number(count) || 0), 0);
      }
      return orders.filter(
        (o) => o.status !== "cancelled" && o.status !== "delivered",
      ).length;
    },
    [orders, ordersSummary],
  );

  const revenueMtd = useMemo(
    () =>
      ordersFinancial?.totals.orders_value ??
      orders.reduce((s, o) => s + (o.payment.total_amount ?? 0), 0),
    [orders, ordersFinancial],
  );

  function applyPreset(preset: DatePreset) {
    setDatePreset(preset);
    const today = new Date();
    const target = new Date(today);
    if (preset === "yesterday") target.setDate(today.getDate() - 1);
    if (preset === "today" || preset === "yesterday") {
      const value = target.toISOString().slice(0, 10);
      setFromDate(value);
      setToDate(value);
    }
    setPage(0);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order Management"
        description="Review and fulfill your daily incoming orders."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OrdersViewSwitch className="w-full sm:w-auto" />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={exportCsv}
            >
              <Download className="size-4" aria-hidden />
              Export CSV
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setSidePeekOrderId(null);
                openDrawer("Create order", () => (
                  <p className="text-sm text-[color:var(--color-text-secondary)]">
                    Order creation from the UI is not wired yet. Use your
                    storefront or API.
                  </p>
                ));
              }}
            >
              <Plus className="size-4" aria-hidden />
              Create Order
            </Button>
          </div>
        }
      />

      {!loading && err ? (
        <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-error)]/25 bg-[color:var(--color-error)]/12 p-3 text-sm text-[color:var(--color-error)] shadow-none">
          {err}
        </p>
      ) : null}

      {showKanban ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-secondary)]">
              لوحة الطلبات (اسحب الكارت لتغيير الحالة)
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowKanban(false)}
            >
              إخفاء اللوحة
            </Button>
          </div>
          <OrdersKanbanBoard
            orders={orders}
            subject={{ role, permissions }}
            headers={headers}
            onOrderUpdated={(next) =>
              setOrders((prev) => upsertOrder(prev, next))
            }
          />
        </div>
      ) : (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowKanban(true)}
          >
            عرض اللوحة
          </Button>
        </div>
      )}

      <div
        id="app-page-filters"
        className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-none"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                من تاريخ
              </label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setDatePreset("custom");
                  setFromDate(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                إلى تاريخ
              </label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setDatePreset("custom");
                  setToDate(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                حالة الدفع
              </label>
              <Select
                value={payment}
                onChange={(e) => {
                  setPayment(e.target.value as PaymentStatus | "");
                  setPage(0);
                }}
              >
                <option value="">كل الدفعات</option>
                {PAYMENTS.filter(Boolean).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                حالة الشحنة
              </label>
              <Select
                value={shippingFilter}
                onChange={(e) => {
                  setShippingFilter(e.target.value as ShipmentStatus | "");
                  setPage(0);
                }}
              >
                <option value="">كل الشحنات</option>
                {SHIPMENT_STATUSES.filter(Boolean).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                المُسند إليه
              </label>
              <Select
                value={assignedTo}
                onChange={(e) => {
                  setAssignedTo(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">الكل</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email || u.id}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                بحث
              </label>
              <Input
                placeholder="رقم طلب، عميل، أو هاتف…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0"
            onClick={resetFilters}
          >
            <RotateCcw className="size-4" aria-hidden />
            إعادة ضبط
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-1 border-t border-[color:var(--color-divider)] pt-3">
          {(
            [
              ["today", "اليوم"],
              ["yesterday", "أمس"],
              ["custom", "تاريخ مخصص"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                datePreset === id
                  ? "bg-[color:var(--color-nav-active-bg)] text-[color:var(--color-primary)]"
                  : "text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-1 overflow-x-auto border-t border-[color:var(--color-divider)] pt-3">
          {QUICK_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setQuickTab(tab.id);
                setStatusPills([]);
                setPage(0);
              }}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                quickTab === tab.id
                  ? "border-[color:var(--color-primary)] text-[color:var(--color-primary)]"
                  : "border-transparent text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-divider)] hover:text-[color:var(--color-text-primary)]",
              )}
            >
              {tab.label}
              {typeof counts[tab.id] === "number"
                ? ` (${counts[tab.id]})`
                : ""}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[color:var(--color-divider)] pt-3">
          <span className="me-2 text-[11px] font-medium text-[color:var(--color-text-muted)]">
            تصفية متعددة:
          </span>
          {statusesForQuickTab(
            quickTab === "all" ? "all" : quickTab,
          ).length > 0 || quickTab === "all"
            ? (quickTab === "all"
                ? Object.values(statusesByBucket()).flat()
                : statusesForQuickTab(quickTab)
              ).map((status) => {
                const active = statusPills.includes(status);
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleStatusPill(status)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                      active
                        ? "bg-[color:var(--color-primary)] text-white"
                        : "bg-[color:var(--color-muted-bg)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)]",
                    )}
                  >
                    {statusLabel(status, "ar")}
                  </button>
                );
              })
            : null}
        </div>
      </div>

      <ResponsiveTable
        desktop={
          <TableWrap>
            <thead>
              <tr>
                <Th>Order ID</Th>
                <Th>Customer</Th>
                <Th>Date</Th>
                {canViewFinance ? <Th>Total</Th> : null}
                <Th>Payment</Th>
                <Th>Fulfillment</Th>
                <Th>Carrier</Th>
                <Th className="w-12">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <Tr key={i}>
                    {Array.from({ length: canViewFinance ? 8 : 7 }).map((__, j) => (
                      <Td key={j}>
                        <Skeleton className="h-4 w-full max-w-[10rem]" />
                      </Td>
                    ))}
                  </Tr>
                ))
              ) : pageRows.length === 0 ? (
                <Tr>
                  <Td
                    colSpan={canViewFinance ? 8 : 7}
                    className="text-center text-[color:var(--color-text-muted)]"
                  >
                    No orders match your filters.
                  </Td>
                </Tr>
              ) : (
                pageRows.map((o) => {
                  const wooOrderId = o.wooCommerceOrderId?.trim();
                  const wooOrderUrl = o.wooCommerceOrderAdminUrl?.trim();
                  const whatsappSentAt = o.whatsappSentAt?.trim();
                  const whatsappUser =
                    o.whatsappSentByUserName?.trim() ||
                    o.whatsappSentByUserId?.trim();

                  const dupPhone = isDuplicateCustomerPhone(o, phoneDupCounts);
                  const dupSize = duplicatePhoneGroupSize(o, phoneDupCounts);

                  return (
                  <Tr
                    key={o.id}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-[color:var(--color-hover-bg)]",
                      sidePeekOrderId === o.id &&
                        "bg-[color:var(--color-nav-active-bg)] ring-1 ring-inset ring-[color:var(--color-primary)]/25",
                      dupPhone &&
                        "border-l-2 border-[color:var(--color-info)] bg-[color:var(--color-info)]/[0.06]",
                    )}
                    onClick={() => openOrderPeek(o)}
                  >
                    <Td>
                      <div className="inline-flex flex-wrap items-center gap-1">
                        <span className="font-mono text-sm font-semibold text-[color:var(--color-primary)]">
                          #{displayOrderId(o)}
                        </span>
                        <Link
                          href={`/orders/${o.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex shrink-0 rounded-[var(--ds-radius-md)] p-1 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-muted-bg)] hover:text-[color:var(--color-primary)]"
                          title="Open full order page"
                          aria-label="Open full order page"
                        >
                          <Maximize2 className="size-3.5" aria-hidden />
                        </Link>
                        {wooOrderUrl ? (
                          <a
                            href={wooOrderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex shrink-0 text-[color:var(--color-primary)] hover:text-[color:var(--color-text-primary)]"
                            title="Open in WooCommerce"
                            aria-label={
                              wooOrderId
                                ? `Open WooCommerce order ${wooOrderId}`
                                : "Open in WooCommerce"
                            }
                          >
                            <ExternalLink className="size-3.5" aria-hidden />
                          </a>
                        ) : null}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-muted-bg)] text-xs font-semibold text-[color:var(--color-text-primary)]">
                          {initials(o.customer.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate font-medium">
                              {o.customer.name}
                            </div>
                            {dupPhone ? (
                              <Badge
                                tone="info"
                                className="shrink-0"
                                title="نفس رقم التليفون في أكثر من طلب ضمن الصفحة الحالية"
                              >
                                نفس العميل · {dupSize} طلبات
                              </Badge>
                            ) : null}
                          </div>
                          <div className="truncate text-xs text-[color:var(--color-text-muted)]">
                            {o.customer.email ?? o.customer.phone ?? "—"}
                          </div>
                        {whatsappSentAt ? (
                          <div
                            className="mt-1 inline-flex items-center gap-1 rounded-full bg-[color:var(--color-success)]/12 px-2 py-0.5 text-[11px] font-medium text-[color:var(--color-success)]"
                            title={`WhatsApp sent at ${formatWhen(whatsappSentAt)}`}
                          >
                            <MessageCircle className="size-3" aria-hidden />
                            واتساب: {whatsappUser ?? "تم"} ·{" "}
                            {formatWhen(whatsappSentAt)}
                          </div>
                        ) : null}
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-sm text-[color:var(--color-text-secondary)]">
                      {formatWhen(o.createdAt)}
                    </Td>
                    {canViewFinance ? (
                      <Td className="font-semibold tabular-nums">
                        {o.payment.total_amount.toLocaleString("ar-EG-u-nu-latn", {
                          style: "currency",
                          currency: "EGP",
                        })}
                      </Td>
                    ) : null}
                    <Td>
                      <PaymentBadge status={o.payment.payment_status} />
                    </Td>
                    <Td>
                      <OrderStatusBadge status={o.status} />
                    </Td>
                    <Td>
                      <div className="space-y-1 text-xs">
                        <div className="font-mono">
                          {o.latestShipmentAwb ?? "—"}
                        </div>
                        <div className="text-[color:var(--color-text-muted)]">
                          {o.latestShipmentCarrierTrackingStatus ??
                            o.latestShipmentStatus ??
                            "No policy"}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="px-2"
                        aria-label="Row actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          openOrderPeek(o);
                        }}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </Td>
                  </Tr>
                  );
                })
              )}
            </tbody>
          </TableWrap>
        }
        mobile={
          <div className="space-y-3">
            {loading ? (
              <OrderCardListSkeleton count={5} />
            ) : pageRows.length === 0 ? (
              <p className="text-center text-sm text-[color:var(--color-text-muted)]">
                No orders
              </p>
            ) : (
              pageRows.map((o) => {
                const wooOrderId = o.wooCommerceOrderId?.trim();
                const wooOrderUrl = o.wooCommerceOrderAdminUrl?.trim();
                const whatsappSentAt = o.whatsappSentAt?.trim();
                const whatsappUser =
                  o.whatsappSentByUserName?.trim() ||
                  o.whatsappSentByUserId?.trim();

                const dupPhoneM = isDuplicateCustomerPhone(o, phoneDupCounts);
                const dupSizeM = duplicatePhoneGroupSize(o, phoneDupCounts);

                return (
                <ResponsiveCard
                  key={o.id}
                  onClick={() => openOrderPeek(o)}
                  className={cn(
                    sidePeekOrderId === o.id &&
                      "ring-1 ring-inset ring-[color:var(--color-primary)]/25",
                    dupPhoneM &&
                      "border-l-2 border-[color:var(--color-info)] bg-[color:var(--color-info)]/[0.06]",
                  )}
                >
                  <div className="space-y-3">
                    <div className="inline-flex flex-wrap items-center gap-1">
                      <span className="font-mono text-sm font-semibold text-[color:var(--color-primary)]">
                        #{displayOrderId(o)}
                      </span>
                      <Link
                        href={`/orders/${o.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex shrink-0 rounded-[var(--ds-radius-md)] p-1 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-muted-bg)] hover:text-[color:var(--color-primary)]"
                        title="Open full order page"
                        aria-label="Open full order page"
                      >
                        <Maximize2 className="size-3.5" aria-hidden />
                      </Link>
                      {wooOrderUrl ? (
                        <a
                          href={wooOrderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex shrink-0 text-[color:var(--color-primary)]"
                          title="Open in WooCommerce"
                          aria-label={
                            wooOrderId
                              ? `Open WooCommerce order ${wooOrderId}`
                              : "Open in WooCommerce"
                          }
                        >
                          <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex size-9 items-center justify-center rounded-full bg-[color:var(--color-muted-bg)] text-xs font-semibold">
                        {initials(o.customer.name)}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium">{o.customer.name}</div>
                          {dupPhoneM ? (
                            <Badge tone="info" className="shrink-0 text-[11px]">
                              نفس العميل · {dupSizeM} طلبات
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    {whatsappSentAt ? (
                      <div className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-success)]/12 px-2 py-1 text-xs font-medium text-[color:var(--color-success)]">
                        <MessageCircle className="size-3.5" aria-hidden />
                        واتساب اتبعت بواسطة {whatsappUser ?? "مستخدم"} ·{" "}
                        {formatWhen(whatsappSentAt)}
                      </div>
                    ) : null}
                    {canViewFinance ? (
                      <div className="text-lg font-semibold tabular-nums">
                        {o.payment.total_amount.toLocaleString("ar-EG-u-nu-latn", {
                          style: "currency",
                          currency: "EGP",
                        })}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <OrderStatusBadge status={o.status} />
                      <PaymentBadge status={o.payment.payment_status} />
                    </div>
                    <div className="rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-2 text-xs text-[color:var(--color-text-secondary)]">
                      Carrier:{" "}
                      <span className="font-mono">
                        {o.latestShipmentAwb ?? "—"}
                      </span>{" "}
                      ·{" "}
                      {o.latestShipmentCarrierTrackingStatus ??
                        o.latestShipmentStatus ??
                        "No policy"}
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        openOrderPeek(o);
                      }}
                    >
                      Summary
                    </Button>
                  </div>
                </ResponsiveCard>
                );
              })
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-3 text-sm text-[color:var(--color-text-secondary)] sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {showingFrom} to {showingTo}
          {pageInfo.hasMore ? " (more available)" : ""}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={currentPage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          <span className="rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] px-3 py-2 text-xs font-medium text-[color:var(--color-text-secondary)]">
            Page {currentPage + 1}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!pageInfo.hasMore}
            onClick={() => {
              if (pageInfo.hasMore) setPage((p) => p + 1);
            }}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
              Active orders
            </p>
            <p className="text-2xl font-bold tabular-nums">{activeOrders}</p>
            <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
              {ordersSummary
                ? "Current pipeline stages"
                : "Current page fallback"}
            </p>
          </CardContent>
        </Card>
        {canViewFinance ? (
          <Card>
            <CardContent className="space-y-1 p-4">
              <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
                Revenue in range
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {revenueMtd.toLocaleString("ar-EG-u-nu-latn", {
                  style: "currency",
                  currency: "EGP",
                })}
              </p>
              <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
                {ordersFinancial
                  ? `${fromDate} to ${toDate}`
                  : "Current page fallback"}
              </p>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
              Pending tickets
            </p>
            <p className="text-2xl font-bold tabular-nums">
              {pendingTickets ?? "—"}
            </p>
            <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
              Open support tickets
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
