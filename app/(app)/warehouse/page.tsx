"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableWrap, Th, Tr, Td } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { ResponsiveCard } from "@/components/responsive/ResponsiveCard";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { useMediaQuery } from "@/lib/ui/use-media-query";
import type { Order } from "@/lib/types/models";
import { OrderStatusBadge } from "@/lib/ui/order-badges";

export default function WarehousePage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const isLgUp = useMediaQuery("(min-width: 1024px)");
  const isMdUp = useMediaQuery("(min-width: 768px)");

  const [orders, setOrders] = useState<Order[]>([]);
  const [awb, setAwb] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [scanLoading, setScanLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [scanPanelOpen, setScanPanelOpen] = useState(true);

  useEffect(() => {
    if (isLgUp) setScanPanelOpen(true);
  }, [isLgUp]);

  async function refresh() {
    setLoadingList(true);
    try {
      const res = await fetch("/api/orders", {
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const all = json.data as Order[];
      setOrders(
        all.filter(
          (o) =>
            o.status === "ready_for_warehouse" ||
            o.status === "packed",
        ),
      );
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "تعذر تحميل الطلبات",
      });
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiSecret, idToken, tenantId, userId, role]);

  async function onScan(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setScanLoading(true);
    try {
      const res = await fetch("/api/shipments/scan", {
        method: "POST",
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        body: JSON.stringify({ awb: awb.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setMsg({
        type: "ok",
        text: `تم التحديث: حالة الطلب ${json.data.order.status}`,
      });
      setAwb("");
      await refresh();
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "فشل المسح",
      });
    } finally {
      setScanLoading(false);
    }
  }

  const showScanBody = isLgUp || !isMdUp || scanPanelOpen;
  const tabletCollapseToggle = isMdUp && !isLgUp;

  return (
    <div className="space-y-6">
      <PageHeader
        title="المخزن"
        description="قائمة الطلبات الجاهزة للتعبئة والشحن، ومسح AWB."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="order-2 lg:order-1 lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>طلبات المخزن</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ResponsiveTable
                desktop={
                  <TableWrap className="rounded-none border-0 shadow-none">
                    <thead>
                      <tr>
                        <Th>الطلب</Th>
                        <Th>العميل</Th>
                        <Th>الحالة</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingList ? (
                        <Tr>
                          <Td colSpan={3} className="text-center text-[color:var(--color-text-muted)]">
                            جاري التحميل…
                          </Td>
                        </Tr>
                      ) : orders.length === 0 ? (
                        <Tr>
                          <Td colSpan={3} className="text-center text-[color:var(--color-text-muted)]">
                            لا توجد طلبات في المخزن
                          </Td>
                        </Tr>
                      ) : (
                        orders.map((o) => (
                          <Tr key={o.id}>
                            <Td className="font-mono text-xs">
                              {o.id.slice(0, 8)}…
                            </Td>
                            <Td>{o.customer.name}</Td>
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
                    {loadingList ? (
                      <p className="text-center text-sm text-[color:var(--color-text-muted)]">
                        جاري التحميل…
                      </p>
                    ) : orders.length === 0 ? (
                      <p className="text-center text-sm text-[color:var(--color-text-muted)]">
                        لا توجد طلبات في المخزن
                      </p>
                    ) : (
                      orders.map((o) => (
                        <ResponsiveCard key={o.id}>
                          <div className="space-y-2 text-sm">
                            <div className="font-mono text-xs text-[color:var(--color-text-muted)]">
                              {o.id.slice(0, 10)}…
                            </div>
                            <div className="font-medium">{o.customer.name}</div>
                            <OrderStatusBadge status={o.status} />
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

        <div className="order-1 lg:order-2 lg:col-span-7">
          <Card className="min-h-[280px] lg:min-h-[320px]">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle>مسح AWB</CardTitle>
              {tabletCollapseToggle ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  aria-expanded={scanPanelOpen}
                  onClick={() => setScanPanelOpen((v) => !v)}
                >
                  {scanPanelOpen ? (
                    <ChevronUp className="size-4" aria-hidden />
                  ) : (
                    <ChevronDown className="size-4" aria-hidden />
                  )}
                  <span className="sr-only">
                    {scanPanelOpen ? "طي لوحة المسح" : "إظهار لوحة المسح"}
                  </span>
                </Button>
              ) : null}
            </CardHeader>
            {showScanBody ? (
              <CardContent>
                <form
                  onSubmit={onScan}
                  className="mx-auto flex max-w-lg flex-col items-stretch gap-4"
                >
                  <Input
                    className="h-12 text-center text-base tracking-wide md:h-14 md:text-lg"
                    placeholder="أدخل AWB"
                    value={awb}
                    onChange={(e) => setAwb(e.target.value)}
                    autoComplete="off"
                  />
                  <Button type="submit" disabled={scanLoading || !awb.trim()}>
                    {scanLoading ? "جاري المعالجة…" : "تسجيل المسح"}
                  </Button>
                </form>
                {msg ? (
                  <div
                    className={
                      msg.type === "ok"
                        ? "mt-4 rounded-lg border border-[color:var(--color-callout-success-border)] bg-[color:var(--color-callout-success-bg)] p-3 text-sm text-[color:var(--color-callout-success-text)]"
                        : "mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                    }
                    role="status"
                  >
                    {msg.text}
                  </div>
                ) : null}
              </CardContent>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
