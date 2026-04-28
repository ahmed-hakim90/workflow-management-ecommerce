"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableWrap, Th, Tr, Td } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { ResponsiveCard } from "@/components/responsive/ResponsiveCard";
import { AwbBarcodeScanner } from "@/components/warehouse/awb-barcode-scanner";
import { OrderCardListSkeleton, Skeleton } from "@/components/ui/skeleton";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { useMediaQuery } from "@/lib/ui/use-media-query";
import { can } from "@/lib/auth/rbac";
import type { Order, OrderStatus } from "@/lib/types/models";
import { OrderStatusBadge } from "@/lib/ui/order-badges";

function warehouseRevertTo(
  status: OrderStatus,
): "invoicing" | "ready_for_warehouse" | null {
  if (status === "ready_for_warehouse") return "invoicing";
  if (status === "packed") return "ready_for_warehouse";
  return null;
}

export default function WarehousePage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const permissions = useSessionStore((s) => s.permissions);
  const authReady = useSessionStore((s) => s.authReady);
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
  const [revertFor, setRevertFor] = useState<Order | null>(null);
  const [revertReason, setRevertReason] = useState("");
  const [revertLoading, setRevertLoading] = useState(false);
  const [wh, setWh] = useState<{
    singleScanFulfills: boolean;
    scanCooldownMs: number;
  } | null>(null);

  useEffect(() => {
    if (isLgUp) setScanPanelOpen(true);
  }, [isLgUp]);

  async function refresh() {
    if (!authReady) return;
    setLoadingList(true);
    try {
      const params = new URLSearchParams({
        status: "ready_for_warehouse,packed",
        limit: "50",
      });
      const res = await fetch(`/api/orders?${params.toString()}`, {
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
      });
      const json = (await res.json()) as {
        data?: { orders?: Order[] };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setOrders(json.data?.orders ?? []);
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "Could not load orders",
      });
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    if (!authReady) return;
    void refresh();
    (async () => {
      try {
        const res = await fetch("/api/settings/warehouse", {
          headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        });
        const json = await res.json();
        if (res.ok) {
          setWh(json.data as { singleScanFulfills: boolean; scanCooldownMs: number });
        } else {
          setWh(null);
        }
      } catch {
        setWh(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, apiSecret, idToken, tenantId, userId, role]);

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
        text: `Updated. Order status: ${json.data.order.status}`,
      });
      setAwb("");
      await refresh();
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "Scan failed",
      });
    } finally {
      setScanLoading(false);
    }
  }

  const revertTo = revertFor
    ? warehouseRevertTo(revertFor.status)
    : null;
  const permissionSubject = { role, permissions };
  const canRevert = can(permissionSubject, "order:revert") && !!revertTo;

  async function onRevert() {
    if (!revertFor || !revertTo || !revertReason.trim() || !canRevert) return;
    setRevertLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/orders/revert", {
        method: "POST",
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        body: JSON.stringify({
          orderId: revertFor.id,
          to: revertTo,
          reason: revertReason.trim(),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setMsg({ type: "ok", text: "Order stage reverted." });
      setRevertFor(null);
      setRevertReason("");
      await refresh();
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "Revert failed",
      });
    } finally {
      setRevertLoading(false);
    }
  }

  const showScanBody = isLgUp || !isMdUp || scanPanelOpen;
  const tabletCollapseToggle = isMdUp && !isLgUp;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse"
        description={
          wh
            ? wh.singleScanFulfills
              ? "Scan mode: a single scan completes shipment (ready → shipped). Set default WhatsApp in settings if needed."
              : `Scan mode: step-by-step. Wait ~${(wh.scanCooldownMs / 1000).toFixed(1)}s after pack before the next scan.`
            : "Orders ready to pack and ship, plus tracking (AWB) scan."
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="order-2 lg:order-1 lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>Warehouse queue</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ResponsiveTable
                desktop={
                  <TableWrap className="rounded-none border-0 shadow-none">
                    <thead>
                      <tr>
                        <Th>Order</Th>
                        <Th>Customer</Th>
                        <Th>Status</Th>
                        {can(permissionSubject, "order:revert") ? <Th>Revert</Th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {loadingList ? (
                        Array.from({ length: 6 }).map((_, i) => (
                          <Tr key={i}>
                            {Array.from({
                              length: can(permissionSubject, "order:revert") ? 4 : 3,
                            }).map((__, j) => (
                              <Td key={j}>
                                <Skeleton className="h-4 w-full max-w-[10rem]" />
                              </Td>
                            ))}
                          </Tr>
                        ))
                      ) : orders.length === 0 ? (
                        <Tr>
                          <Td
                            colSpan={can(permissionSubject, "order:revert") ? 4 : 3}
                            className="text-center text-[color:var(--color-text-muted)]"
                          >
                            No warehouse orders
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
                            {can(permissionSubject, "order:revert") ? (
                              <Td>
                                {warehouseRevertTo(o.status) ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      setRevertFor(o);
                                      setRevertReason("");
                                    }}
                                  >
                                    Revert
                                  </Button>
                                ) : (
                                  "—"
                                )}
                              </Td>
                            ) : null}
                          </Tr>
                        ))
                      )}
                    </tbody>
                  </TableWrap>
                }
                mobile={
                  <div className="space-y-3 p-4">
                    {loadingList ? (
                      <OrderCardListSkeleton count={4} />
                    ) : orders.length === 0 ? (
                      <p className="text-center text-sm text-[color:var(--color-text-muted)]">
                        No warehouse orders
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
                            {can(permissionSubject, "order:revert") && warehouseRevertTo(o.status) ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  setRevertFor(o);
                                  setRevertReason("");
                                }}
                              >
                                Revert stage
                              </Button>
                            ) : null}
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
              <CardTitle>Track scan (AWB)</CardTitle>
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
                    {scanPanelOpen ? "Collapse scan panel" : "Expand scan panel"}
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
                  <AwbBarcodeScanner
                    onDecoded={(v) => {
                      setAwb(v);
                      setMsg({
                        type: "ok",
                        text: "Barcode read. Press Register scan or continue.",
                      });
                    }}
                    disabled={scanLoading}
                  />
                  <Input
                    className="h-12 text-center text-base tracking-wide md:h-14 md:text-lg"
                    placeholder="Tracking number (AWB)"
                    value={awb}
                    onChange={(e) => setAwb(e.target.value)}
                    autoComplete="off"
                    inputMode="text"
                  />
                  <Button type="submit" disabled={scanLoading || !awb.trim()}>
                    {scanLoading ? "Processing…" : "Register scan"}
                  </Button>
                </form>
                {msg &&
                (msg.type === "ok" || (!loadingList && msg.type === "err")) ? (
                  <div
                    className={
                      msg.type === "ok"
                        ? "mt-4 rounded-xl border border-[color:var(--color-callout-success-border)] bg-[color:var(--color-callout-success-bg)] p-3 text-sm text-[color:var(--color-callout-success-text)] shadow-[var(--shadow-neo-raised-sm)]"
                        : "mt-4 rounded-xl border-0 bg-[color:var(--color-error)]/12 p-3 text-sm text-[color:var(--color-error)] shadow-[var(--shadow-neo-raised-sm)]"
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

      <Modal
        open={revertFor !== null}
        title="Revert stage"
        onClose={() => {
          if (revertLoading) return;
          setRevertFor(null);
          setRevertReason("");
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={revertLoading}
              onClick={() => {
                if (!revertLoading) {
                  setRevertFor(null);
                  setRevertReason("");
                }
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void onRevert()}
              disabled={revertLoading || !revertReason.trim() || !canRevert}
            >
              {revertLoading ? "…" : "Confirm"}
            </Button>
          </div>
        }
      >
        {revertFor && revertTo ? (
          <div className="space-y-3 text-sm">
            <p className="text-[color:var(--color-text-secondary)]">
              This will move order{" "}
              <span className="font-mono">{revertFor.id.slice(0, 8)}…</span> from{" "}
              <span className="font-medium">
                {revertFor.status === "packed" ? "Packed" : "Ready for warehouse"}
              </span>{" "}
              to{" "}
              <span className="font-medium">
                {revertTo === "ready_for_warehouse"
                  ? "Ready for warehouse (and void label/pack if applicable)"
                  : "Invoicing / confirmation"}
              </span>
              .
            </p>
            <div className="space-y-1">
              <label
                className="text-xs font-medium text-[color:var(--color-text-secondary)]"
                htmlFor="revert-reason"
              >
                Reason (required)
              </label>
              <textarea
                id="revert-reason"
                className="min-h-[88px] w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-input-bg)] p-2 text-sm"
                value={revertReason}
                onChange={(e) => setRevertReason(e.target.value)}
                placeholder="Short reason for supervisor / audit log"
                disabled={revertLoading}
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
