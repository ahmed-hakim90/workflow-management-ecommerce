"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  Download,
  ExternalLink,
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
import type { Order, PaymentStatus } from "@/lib/types/models";
import { OrderStatusBadge, PaymentBadge } from "@/lib/ui/order-badges";
import {
  arrangeOrdersByDuplicatePhoneClusters,
  duplicatePhoneCounts,
  duplicatePhoneGroupSize,
  isDuplicateCustomerPhone,
} from "@/lib/ui/order-phone-grouping";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/ui/cn";
import { OrdersViewSwitch } from "@/components/orders/orders-view-switch";
import { can } from "@/lib/auth/rbac";
import { COLLECTIONS } from "@/lib/db/collections";
import {
  getFirebaseClientAuth,
  getFirebaseClientDb,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";

const PAGE_SIZE = 10;
const PAYMENTS: (PaymentStatus | "")[] = ["", "paid", "partial", "cod"];

type QuickTab = "all" | "pending" | "shipped" | "cancelled";
type DatePreset = "today" | "yesterday" | "custom";

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

function statusesForQuickTab(tab: QuickTab) {
  if (tab === "pending") return ["pending_confirmation"];
  if (tab === "shipped") return ["shipped", "delivered", "follow_up"];
  if (tab === "cancelled") return ["cancelled"];
  return [];
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
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const permissions = useSessionStore((s) => s.permissions);
  const authReady = useSessionStore((s) => s.authReady);
  const openDrawer = useUiStore((s) => s.openDrawer);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [payment, setPayment] = useState<PaymentStatus | "">("");
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
  const canViewFinance = can({ role, permissions }, "finance:view");
  const currentCursor = cursorStack[page] ?? null;

  useEffect(() => {
    setPage(0);
    setCursorStack([null]);
  }, [q, payment, quickTab, fromDate, toDate]);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    let unsubAuth: (() => void) | undefined;
    let unsubFs: (() => void) | undefined;
    const headers = buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role });
    const listenerSince = new Date().toISOString();
    const activeStatuses = statusesForQuickTab(quickTab);

    const orderMatchesCurrentFilters = (order: Order) => {
      if (!orderIsInsideDateRange(order, fromDate, toDate)) return false;
      if (activeStatuses.length > 0 && !activeStatuses.includes(order.status)) {
        return false;
      }
      if (payment && order.payment.payment_status !== payment) return false;
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
        /* Keep the current row; the next Firestore change can retry this one-order refresh. */
      }
    };

    const startRealtimeUpdates = () => {
      if (!idToken?.trim() || !isFirebaseClientConfigured()) return;
      const auth = getFirebaseClientAuth();
      const db = getFirebaseClientDb();
      const qo = query(
        collection(db, COLLECTIONS.orders),
        where("tenantId", "==", tenantId),
        where("updatedAt", ">", listenerSince),
        orderBy("updatedAt", "desc"),
      );

      unsubAuth = onAuthStateChanged(auth, (user) => {
        unsubFs?.();
        unsubFs = undefined;
        if (cancelled || !user) return;
        try {
          unsubFs = onSnapshot(
            qo,
            (snap) => {
              if (cancelled) return;
              for (const change of snap.docChanges()) {
                if (change.type === "removed") {
                  setOrders((prev) =>
                    prev.filter((order) => order.id !== change.doc.id),
                  );
                  continue;
                }

                const rawOrder = {
                  id: change.doc.id,
                  ...change.doc.data(),
                } as Order;
                if (rawOrder.tenantId !== tenantId) continue;
                void mergeChangedOrder(rawOrder.id, rawOrder);
              }
            },
            (listenerErr) => {
              const code =
                listenerErr && typeof listenerErr === "object" && "code" in listenerErr
                  ? String((listenerErr as { code?: string }).code)
                  : "";
              if (code === "permission-denied") {
                console.warn(
                  "[orders] Firestore realtime: permission-denied — allow authenticated reads on `orders` for this tenant in Firestore rules (e.g. match tenant via custom claims), or rely on API refresh only.",
                );
              } else {
                console.warn("[orders] Firestore listener:", listenerErr);
              }
            },
          );
        } catch {
          /* Firestore listener unavailable; avoid falling back to repeated full-list fetches. */
        }
      });
    };

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams();
        if (fromDate) params.set("from", fromDate);
        if (toDate) params.set("to", toDate);
        if (activeStatuses.length > 0) params.set("status", activeStatuses.join(","));
        if (payment) params.set("payment", payment);
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
      unsubAuth?.();
      unsubFs?.();
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
    q,
    page,
    currentCursor,
  ]);

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

  const counts = useMemo(() => {
    return {
      all: orders.length,
      pending: orders.filter((o) => o.status === "pending_confirmation")
        .length,
      shipped: orders.filter((o) =>
        ["shipped", "delivered", "follow_up"].includes(o.status),
      ).length,
      cancelled: orders.filter((o) => o.status === "cancelled").length,
    };
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
    setQuickTab("all");
    setDatePreset("custom");
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - 30);
    setFromDate(f.toISOString().slice(0, 10));
    setToDate(t.toISOString().slice(0, 10));
    setPage(0);
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

  function openOrderDrawer(o: Order) {
    openDrawer("Order summary", () => (
      <div className="space-y-3 text-sm">
        <div>
          <span className="text-[color:var(--color-text-muted)]">ID</span>
          <div className="font-mono text-xs break-all">{o.id}</div>
        </div>
        <div>
          <span className="text-[color:var(--color-text-muted)]">Customer</span>
          <div>{o.customer.name}</div>
        </div>
        <div>
          <span className="text-[color:var(--color-text-muted)]">Phone</span>
          <div>{o.customer.phone ?? "—"}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <OrderStatusBadge status={o.status} />
          <PaymentBadge status={o.payment.payment_status} />
        </div>
      </div>
    ));
  }

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status !== "cancelled" &&
          o.status !== "delivered",
      ).length,
    [orders],
  );

  const revenueMtd = useMemo(
    () =>
      orders
        .reduce((s, o) => s + (o.payment.total_amount ?? 0), 0),
    [orders],
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
              onClick={() =>
                openDrawer("Create order", () => (
                  <p className="text-sm text-[color:var(--color-text-secondary)]">
                    Order creation from the UI is not wired yet. Use your
                    storefront or API.
                  </p>
                ))
              }
            >
              <Plus className="size-4" aria-hidden />
              Create Order
            </Button>
          </div>
        }
      />

      {!loading && err ? (
        <p className="rounded-xl border-0 bg-[color:var(--color-error)]/12 p-3 text-sm text-[color:var(--color-error)] shadow-[var(--shadow-neo-raised-sm)]">
          {err}
        </p>
      ) : null}

      <div className="rounded-xl border-0 bg-[color:var(--color-card)] p-4 shadow-[var(--shadow-notion-subtle)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                Date range — from
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
              <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                Date range — to
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
              <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                Payment status
              </label>
              <Select
                value={payment}
                onChange={(e) => {
                  setPayment(e.target.value as PaymentStatus | "");
                  setPage(0);
                }}
              >
                <option value="">All Payments</option>
                {PAYMENTS.filter(Boolean).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                Search
              </label>
              <Input
                placeholder="Order, customer, or phone…"
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
            Reset
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-1 border-t border-[color:var(--color-divider)] pt-3">
          {(
            [
              ["today", "Today"],
              ["yesterday", "Yesterday"],
              ["custom", "Custom range"],
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

        <div className="mt-2 flex flex-wrap gap-1 border-t border-[color:var(--color-divider)] pt-3">
          {(
            [
              ["all", `All Orders (${counts.all})`],
              ["pending", `Pending (${counts.pending})`],
              ["shipped", `Shipped (${counts.shipped})`],
              ["cancelled", `Cancelled (${counts.cancelled})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setQuickTab(id);
                setPage(0);
              }}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                quickTab === id
                  ? "border-[color:var(--color-primary)] text-[color:var(--color-primary)]"
                  : "border-transparent text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-divider)] hover:text-[color:var(--color-text-primary)]",
              )}
            >
              {label}
            </button>
          ))}
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
                <Th>Bosta</Th>
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
                      dupPhone &&
                        "border-l-2 border-[color:var(--color-info)] bg-[color:var(--color-info)]/[0.06]",
                    )}
                  >
                    <Td>
                      <div className="inline-flex flex-wrap items-center gap-1">
                        <Link
                          href={`/orders/${o.id}`}
                          className="font-mono text-sm font-semibold text-[color:var(--color-primary)] hover:underline"
                        >
                          #{displayOrderId(o)}
                        </Link>
                        {wooOrderUrl ? (
                          <a
                            href={wooOrderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
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
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-muted-bg)] text-xs font-semibold text-[color:var(--color-text-primary)] shadow-[var(--shadow-neo-inset)]">
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
                        onClick={() => openOrderDrawer(o)}
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
                  className={cn(
                    dupPhoneM &&
                      "border-l-2 border-[color:var(--color-info)] bg-[color:var(--color-info)]/[0.06]",
                  )}
                >
                  <div className="space-y-3">
                    <div className="inline-flex flex-wrap items-center gap-1">
                      <Link
                        href={`/orders/${o.id}`}
                        className="font-mono text-sm font-semibold text-[color:var(--color-primary)]"
                      >
                        #{displayOrderId(o)}
                      </Link>
                      {wooOrderUrl ? (
                        <a
                          href={wooOrderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
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
                      <span className="flex size-9 items-center justify-center rounded-full bg-[color:var(--color-muted-bg)] text-xs font-semibold shadow-[var(--shadow-neo-inset)]">
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
                    <div className="rounded-xl bg-[color:var(--color-bg-subtle)] p-2 text-xs text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-inset)]">
                      Bosta:{" "}
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
                      onClick={() => openOrderDrawer(o)}
                    >
                      Quick view
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
          <span className="rounded-xl bg-[color:var(--color-bg-subtle)] px-3 py-2 text-xs font-medium text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-inset)]">
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
            <p className="text-xs font-medium text-[color:var(--color-success)]">
              +12.5% from last week
            </p>
          </CardContent>
        </Card>
        {canViewFinance ? (
          <Card>
            <CardContent className="space-y-1 p-4">
              <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
                Revenue (MTD)
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {revenueMtd.toLocaleString("ar-EG-u-nu-latn", {
                  style: "currency",
                  currency: "EGP",
                })}
              </p>
              <p className="text-xs font-medium text-[color:var(--color-success)]">
                +8.2% vs prior period (demo)
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
            <p className="text-xs font-medium text-[color:var(--color-error)]">
              Urgent actions may be waiting in support
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
