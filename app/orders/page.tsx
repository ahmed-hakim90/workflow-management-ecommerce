"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { TableWrap, Th, Tr, Td } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { ResponsiveCard } from "@/components/responsive/ResponsiveCard";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { useUiStore } from "@/store/zustand/ui-store";
import type { Order, OrderStatus, PaymentStatus } from "@/lib/types/models";
import { OrderStatusBadge, PaymentBadge } from "@/lib/ui/order-badges";

const PAGE_SIZE = 10;
const STATUSES: (OrderStatus | "")[] = [
  "",
  "pending_confirmation",
  "confirmed",
  "invoicing",
  "ready_for_warehouse",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
];
const PAYMENTS: (PaymentStatus | "")[] = ["", "paid", "partial", "cod"];

export default function OrdersPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const openDrawer = useUiStore((s) => s.openDrawer);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [payment, setPayment] = useState<PaymentStatus | "">("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        const res = await fetch(`/api/orders?${params}`, {
          headers: buildAuthHeaders({ apiSecret, tenantId, userId, role }),
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
  }, [apiSecret, tenantId, userId, role, status]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (payment && o.payment.payment_status !== payment) return false;
      if (!needle) return true;
      const id = o.id.toLowerCase();
      const phone = (o.customer.phone ?? "").toLowerCase();
      return id.includes(needle) || phone.includes(needle);
    });
  }, [orders, q, payment]);

  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

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
    openDrawer("ملخص الطلب", () => (
      <div className="space-y-3 text-sm">
        <div>
          <span className="text-[color:var(--color-text-muted)]">المعرّف</span>
          <div className="font-mono text-xs break-all">{o.id}</div>
        </div>
        <div>
          <span className="text-[color:var(--color-text-muted)]">العميل</span>
          <div>{o.customer.name}</div>
        </div>
        <div>
          <span className="text-[color:var(--color-text-muted)]">الهاتف</span>
          <div>{o.customer.phone ?? "—"}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <OrderStatusBadge status={o.status} />
          <PaymentBadge status={o.payment.payment_status} />
        </div>
      </div>
    ));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الطلبات"
        description="بحث، فلترة، وتصدير قائمة الطلبات."
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={exportCsv}
          >
            <Download className="size-4" aria-hidden />
            تصدير CSV
          </Button>
        }
      />

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-[var(--shadow-card)] lg:flex-row lg:items-end">
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[color:var(--color-text-secondary)]">بحث</label>
            <Input
              placeholder="رقم الطلب أو الهاتف"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[color:var(--color-text-secondary)]">الحالة</label>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as OrderStatus | "");
                setPage(0);
              }}
            >
              <option value="">الكل</option>
              {STATUSES.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[color:var(--color-text-secondary)]">الدفع</label>
            <Select
              value={payment}
              onChange={(e) => {
                setPayment(e.target.value as PaymentStatus | "");
                setPage(0);
              }}
            >
              <option value="">الكل</option>
              {PAYMENTS.filter(Boolean).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <ResponsiveTable
        desktop={
          <TableWrap>
            <thead>
              <tr>
                <Th>الطلب</Th>
                <Th>العميل</Th>
                <Th>المبلغ</Th>
                <Th>الدفع</Th>
                <Th>الحالة</Th>
                <Th>إجراءات</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <Tr>
                  <Td colSpan={6} className="text-center text-[color:var(--color-text-muted)]">
                    جاري التحميل…
                  </Td>
                </Tr>
              ) : pageRows.length === 0 ? (
                <Tr>
                  <Td colSpan={6} className="text-center text-[color:var(--color-text-muted)]">
                    لا توجد نتائج
                  </Td>
                </Tr>
              ) : (
                pageRows.map((o) => (
                  <Tr key={o.id}>
                    <Td className="font-mono text-xs">{o.id.slice(0, 10)}…</Td>
                    <Td>{o.customer.name}</Td>
                    <Td>{o.payment.total_amount}</Td>
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
                        onClick={() => openOrderDrawer(o)}
                      >
                        عرض
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
                جاري التحميل…
              </p>
            ) : pageRows.length === 0 ? (
              <p className="text-center text-sm text-[color:var(--color-text-muted)]">
                لا توجد نتائج
              </p>
            ) : (
              pageRows.map((o) => (
                <ResponsiveCard key={o.id}>
                  <div className="space-y-3">
                    <div className="font-mono text-xs text-[color:var(--color-text-muted)]">
                      {o.id.slice(0, 12)}…
                    </div>
                    <div className="font-medium text-[color:var(--color-text-primary)]">
                      {o.customer.name}
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      {o.payment.total_amount}
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
                      عرض التفاصيل
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
          صفحة {page + 1} من {totalPages} · {filtered.length} طلب
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            السابق
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
}
