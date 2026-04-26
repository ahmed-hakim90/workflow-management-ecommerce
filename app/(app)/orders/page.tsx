"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, MoreHorizontal, Plus, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { TableWrap, Th, Tr, Td } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { ResponsiveCard } from "@/components/responsive/ResponsiveCard";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { useUiStore } from "@/store/zustand/ui-store";
import type { Order, PaymentStatus } from "@/lib/types/models";
import { OrderStatusBadge, PaymentBadge } from "@/lib/ui/order-badges";
import { cn } from "@/lib/ui/cn";
import { OrdersViewSwitch } from "@/components/orders/orders-view-switch";

const PAGE_SIZE = 10;
const PAYMENTS: (PaymentStatus | "")[] = ["", "paid", "partial", "cod"];

type QuickTab = "all" | "pending" | "shipped" | "cancelled";

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

function inDateRange(iso: string, from: string, to: string) {
  const t = new Date(iso).getTime();
  const a = new Date(from + "T00:00:00").getTime();
  const b = new Date(to + "T23:59:59").getTime();
  return t >= a && t <= b;
}

export default function OrdersPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const openDrawer = useUiStore((s) => s.openDrawer);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [payment, setPayment] = useState<PaymentStatus | "">("");
  const [page, setPage] = useState(0);
  const [quickTab, setQuickTab] = useState<QuickTab>("all");
  const [fromDate, setFromDate] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() - 30);
    return t.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [pendingTickets, setPendingTickets] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/orders`, {
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
  }, [apiSecret, idToken, tenantId, userId, role]);

  useEffect(() => {
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
  }, [apiSecret, idToken, tenantId, userId, role]);

  const tabFiltered = useMemo(() => {
    return orders.filter((o) => {
      if (!inDateRange(o.createdAt, fromDate, toDate)) return false;
      if (quickTab === "pending") return o.status === "pending_confirmation";
      if (quickTab === "shipped")
        return (
          o.status === "shipped" ||
          o.status === "delivered" ||
          o.status === "follow_up"
        );
      if (quickTab === "cancelled") return o.status === "cancelled";
      return true;
    });
  }, [orders, quickTab, fromDate, toDate]);

  const counts = useMemo(() => {
    const inRange = orders.filter((o) =>
      inDateRange(o.createdAt, fromDate, toDate),
    );
    return {
      all: inRange.length,
      pending: inRange.filter((o) => o.status === "pending_confirmation")
        .length,
      shipped: inRange.filter((o) =>
        ["shipped", "delivered", "follow_up"].includes(o.status),
      ).length,
      cancelled: inRange.filter((o) => o.status === "cancelled").length,
    };
  }, [orders, fromDate, toDate]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tabFiltered.filter((o) => {
      if (payment && o.payment.payment_status !== payment) return false;
      if (!needle) return true;
      const id = o.id.toLowerCase();
      const phone = (o.customer.phone ?? "").toLowerCase();
      const name = (o.customer.name ?? "").toLowerCase();
      const email = (o.customer.email ?? "").toLowerCase();
      return (
        id.includes(needle) ||
        phone.includes(needle) ||
        name.includes(needle) ||
        email.includes(needle)
      );
    });
  }, [tabFiltered, q, payment]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE,
  );
  const showingFrom = filtered.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const showingTo = Math.min(
    (currentPage + 1) * PAGE_SIZE,
    filtered.length,
  );

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages - 1));
  }, [totalPages]);

  function resetFilters() {
    setQ("");
    setPayment("");
    setQuickTab("all");
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - 30);
    setFromDate(f.toISOString().slice(0, 10));
    setToDate(t.toISOString().slice(0, 10));
    setPage(0);
  }

  function exportCsv() {
    const rows = filtered.map((o) => ({
      id: o.id,
      status: o.status,
      customer: o.customer.name,
      phone: o.customer.phone ?? "",
      total: o.payment.total_amount,
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
          o.status !== "delivered" &&
          inDateRange(o.createdAt, fromDate, toDate),
      ).length,
    [orders, fromDate, toDate],
  );

  const revenueMtd = useMemo(
    () =>
      orders
        .filter((o) => inDateRange(o.createdAt, fromDate, toDate))
        .reduce((s, o) => s + (o.payment.total_amount ?? 0), 0),
    [orders, fromDate, toDate],
  );

  const pageNumbers = useMemo(() => {
    const windowSize = 5;
    const start = Math.max(
      0,
      Math.min(currentPage - 2, totalPages - windowSize),
    );
    return Array.from(
      { length: Math.min(windowSize, totalPages) },
      (_, i) => start + i,
    ).filter((n) => n < totalPages);
  }, [currentPage, totalPages]);

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

      {err ? (
        <p className="rounded-xl border-0 bg-[color:var(--color-error)]/12 p-3 text-sm text-[color:var(--color-error)] shadow-[var(--shadow-neo-raised-sm)]">
          {err}
        </p>
      ) : null}

      <div className="rounded-2xl border-0 bg-[color:var(--color-card)] p-4 shadow-[var(--shadow-neo-raised)]">
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
                <Th>Total</Th>
                <Th>Payment</Th>
                <Th>Fulfillment</Th>
                <Th className="w-12">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <Tr>
                  <Td
                    colSpan={7}
                    className="text-center text-[color:var(--color-text-muted)]"
                  >
                    Loading…
                  </Td>
                </Tr>
              ) : pageRows.length === 0 ? (
                <Tr>
                  <Td
                    colSpan={7}
                    className="text-center text-[color:var(--color-text-muted)]"
                  >
                    No orders match your filters.
                  </Td>
                </Tr>
              ) : (
                pageRows.map((o) => (
                  <Tr key={o.id}>
                    <Td>
                      <Link
                        href={`/orders/${o.id}`}
                        className="font-mono text-sm font-medium text-[color:var(--color-primary)] hover:underline"
                      >
                        #{o.id.slice(0, 8).toUpperCase()}
                      </Link>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-muted-bg)] text-xs font-semibold text-[color:var(--color-text-primary)] shadow-[var(--shadow-neo-inset)]">
                          {initials(o.customer.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {o.customer.name}
                          </div>
                          <div className="truncate text-xs text-[color:var(--color-text-muted)]">
                            {o.customer.email ?? o.customer.phone ?? "—"}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-sm text-[color:var(--color-text-secondary)]">
                      {formatWhen(o.createdAt)}
                    </Td>
                    <Td className="font-semibold tabular-nums">
                      {o.payment.total_amount.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </Td>
                    <Td>
                      <PaymentBadge status={o.payment.payment_status} />
                    </Td>
                    <Td>
                      <OrderStatusBadge status={o.status} />
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
                ))
              )}
            </tbody>
          </TableWrap>
        }
        mobile={
          <div className="space-y-3">
            {loading ? (
              <p className="text-center text-sm text-[color:var(--color-text-muted)]">
                Loading…
              </p>
            ) : pageRows.length === 0 ? (
              <p className="text-center text-sm text-[color:var(--color-text-muted)]">
                No orders
              </p>
            ) : (
              pageRows.map((o) => (
                <ResponsiveCard key={o.id}>
                  <div className="space-y-3">
                    <Link
                      href={`/orders/${o.id}`}
                      className="font-mono text-sm font-medium text-[color:var(--color-primary)]"
                    >
                      #{o.id.slice(0, 8).toUpperCase()}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="flex size-9 items-center justify-center rounded-full bg-[color:var(--color-muted-bg)] text-xs font-semibold shadow-[var(--shadow-neo-inset)]">
                        {initials(o.customer.name)}
                      </span>
                      <div className="font-medium">{o.customer.name}</div>
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      {o.payment.total_amount.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <OrderStatusBadge status={o.status} />
                      <PaymentBadge status={o.payment.payment_status} />
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
              ))
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-3 text-sm text-[color:var(--color-text-secondary)] sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {showingFrom} to {showingTo} of {filtered.length} entries
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
          {pageNumbers.map((n) => (
            <Button
              key={n}
              type="button"
              variant={n === currentPage ? "primary" : "secondary"}
              size="sm"
              className="min-w-9 px-2"
              onClick={() => setPage(n)}
            >
              {n + 1}
            </Button>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
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
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
              Revenue (MTD)
            </p>
            <p className="text-2xl font-bold tabular-nums">
              {revenueMtd.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </p>
            <p className="text-xs font-medium text-[color:var(--color-success)]">
              +8.2% vs prior period (demo)
            </p>
          </CardContent>
        </Card>
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
