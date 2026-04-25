"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableWrap, Th, Tr, Td } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { ResponsiveCard } from "@/components/responsive/ResponsiveCard";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import type { Order } from "@/lib/types/models";
import { OrderStatusBadge, PaymentBadge } from "@/lib/ui/order-badges";

const StageBarChart = dynamic(
  () =>
    import("@/components/charts/stage-bar-chart").then((m) => m.StageBarChart),
  { loading: () => <Skeleton className="h-64 w-full" /> },
);

type UserStatsPayload = {
  target: number;
  done: number;
  performancePct: number;
  stats: { confirmed?: number; invoiced?: number; packed?: number };
};

export default function DashboardPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);

  const [stats, setStats] = useState<UserStatsPayload | null>(null);
  const [stages, setStages] = useState<{ name: string; count: number }[]>([]);
  const [recent, setRecent] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [sRes, oRes, aRes] = await Promise.all([
          fetch("/api/users/stats", {
            headers: buildAuthHeaders({ apiSecret, tenantId, userId, role }),
          }),
          fetch("/api/orders", {
            headers: buildAuthHeaders({ apiSecret, tenantId, userId, role }),
          }),
          fetch("/api/admin/summary", {
            headers: buildAuthHeaders({ apiSecret, tenantId, userId, role }),
          }),
        ]);
        const sJson = await sRes.json();
        const oJson = await oRes.json();
        if (!sRes.ok) throw new Error(sJson.error ?? sRes.statusText);
        if (!oRes.ok) throw new Error(oJson.error ?? oRes.statusText);
        if (!cancelled) {
          setStats(sJson.data as UserStatsPayload);
          const orders = oJson.data as Order[];
          setRecent(orders.slice(0, 8));
        }
        const aJson = await aRes.json();
        if (aRes.ok && !cancelled) {
          const st = (aJson.data?.stages ?? {}) as Record<string, number>;
          setStages(
            Object.entries(st)
              .filter(([k]) => k !== "warehouse")
              .map(([name, count]) => ({
                name: name.replaceAll("_", " "),
                count: Number(count) || 0,
              })),
          );
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
  }, [apiSecret, tenantId, userId, role]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="لوحة التحكم"
        description="مؤشراتك اليومية، نظرة على المراحل، وأحدث الطلبات."
      />

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-[color:var(--color-text-muted)]">
              الهدف اليومي
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-semibold">{stats?.target ?? 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-[color:var(--color-text-muted)]">
              المنجز
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-semibold">{stats?.done ?? 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-[color:var(--color-text-muted)]">
              الأداء %
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-semibold">
                {stats?.performancePct ?? 0}%
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-[color:var(--color-text-muted)]">
              تفصيل سريع
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-[color:var(--color-text-secondary)]">
            {loading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="space-y-1">
                <div>تأكيد: {stats?.stats?.confirmed ?? 0}</div>
                <div>فواتير: {stats?.stats?.invoiced ?? 0}</div>
                <div>تعبئة: {stats?.stats?.packed ?? 0}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>توزيع المراحل</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : stages.length > 0 ? (
              <StageBarChart data={stages} />
            ) : (
              <p className="text-sm text-[color:var(--color-text-muted)]">
                لا بيانات مراحل (يتطلب صلاحية ملخص الإدارة).
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>أحدث الطلبات</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ResponsiveTable
              desktop={
                <TableWrap className="rounded-none border-0 shadow-none">
                  <thead>
                    <tr>
                      <Th>الطلب</Th>
                      <Th>العميل</Th>
                      <Th>الدفع</Th>
                      <Th>الحالة</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <Tr>
                        <Td
                          colSpan={4}
                          className="text-center text-[color:var(--color-text-muted)]"
                        >
                          جاري التحميل…
                        </Td>
                      </Tr>
                    ) : recent.length === 0 ? (
                      <Tr>
                        <Td
                          colSpan={4}
                          className="text-center text-[color:var(--color-text-muted)]"
                        >
                          لا طلبات
                        </Td>
                      </Tr>
                    ) : (
                      recent.map((o) => (
                        <Tr key={o.id}>
                          <Td className="font-mono text-xs">
                            {o.id.slice(0, 8)}…
                          </Td>
                          <Td>{o.customer.name}</Td>
                          <Td>
                            <PaymentBadge status={o.payment.payment_status} />
                          </Td>
                          <Td>
                            <OrderStatusBadge status={o.status} />
                          </Td>
                        </Tr>
                      ))
                    )}
                  </tbody>
                </TableWrap>
              }
              mobile={
                <div className="space-y-3 p-4">
                  {loading ? (
                    <p className="text-center text-sm text-[color:var(--color-text-muted)]">
                      جاري التحميل…
                    </p>
                  ) : recent.length === 0 ? (
                    <p className="text-center text-sm text-[color:var(--color-text-muted)]">
                      لا طلبات
                    </p>
                  ) : (
                    recent.map((o) => (
                      <ResponsiveCard key={o.id}>
                        <div className="space-y-2 text-sm">
                          <div className="font-mono text-xs text-[color:var(--color-text-muted)]">
                            {o.id.slice(0, 10)}…
                          </div>
                          <div className="font-medium text-[color:var(--color-text-primary)]">
                            {o.customer.name}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <PaymentBadge status={o.payment.payment_status} />
                            <OrderStatusBadge status={o.status} />
                          </div>
                        </div>
                      </ResponsiveCard>
                    ))
                  )}
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
