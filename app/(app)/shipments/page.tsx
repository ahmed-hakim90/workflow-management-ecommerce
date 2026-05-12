"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableWrap, Th, Tr, Td } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import type { Shipment, ShipmentStatus } from "@/lib/types/models";
import { cn } from "@/lib/ui/cn";

function carrierLabel(s: Shipment) {
  if (s.provider === "bosta") return "Bosta";
  if (s.provider === "jnt_egypt") return "J&T Egypt";
  if (s.provider === "fedex") return "FedEx";
  return "Demo carrier";
}

function statusStyle(st: ShipmentStatus) {
  if (st === "delivered") return "text-[color:var(--color-success)]";
  if (st === "shipped" || st === "packed") return "text-[color:var(--color-primary)]";
  if (st === "failed" || st === "cancelled")
    return "text-[color:var(--color-error)]";
  return "text-[color:var(--color-text-secondary)]";
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US");
}

function formatCarrierFee(value?: number) {
  if (value === undefined || value === null) return "—";
  return value.toLocaleString("ar-EG-u-nu-latn", {
    style: "currency",
    currency: "EGP",
  });
}

export default function ShipmentsPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const authReady = useSessionStore((s) => s.authReady);

  const [list, setList] = useState<Shipment[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() - 30);
    return t.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  async function refresh(cancelled?: () => boolean) {
      setLoading(true);
      setErr(null);
      setOk(null);
      try {
        const params = new URLSearchParams();
        if (fromDate) params.set("from", fromDate);
        if (toDate) params.set("to", toDate);
        const res = await fetch(`/api/shipments?${params.toString()}`, {
          headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        const rows = json.data as Shipment[];
        if (!cancelled?.()) {
          setList(rows);
          setSelectedId((id) => id ?? rows[0]?.id ?? null);
        }
      } catch (e) {
        if (!cancelled?.())
          setErr(e instanceof Error ? e.message : "Failed to load shipments");
      } finally {
        if (!cancelled?.()) setLoading(false);
      }
  }

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    void refresh(() => cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, apiSecret, idToken, tenantId, userId, role, fromDate, toDate]);

  const selected = useMemo(
    () => list.find((s) => s.id === selectedId) ?? null,
    [list, selectedId],
  );

  const timeline = useMemo(() => {
    if (!selected) return [];
    const items: { label: string; at?: string }[] = [
      { label: "Shipment created", at: selected.createdAt },
    ];
    if (selected.packedAt) items.push({ label: "Packed at warehouse", at: selected.packedAt });
    if (selected.shippedAt) items.push({ label: "Handed to carrier", at: selected.shippedAt });
    if (selected.status === "delivered")
      items.push({ label: "Delivered", at: selected.updatedAt });
    for (const ev of selected.trackingHistory ?? []) {
      items.push({ label: `Carrier: ${ev.status}`, at: ev.at });
    }
    return items;
  }, [selected]);

  async function postShipmentAction(shipmentId: string, action: "sync" | "cancel") {
    if (action === "cancel" && !window.confirm("Cancel this carrier waybill?")) return;
    setBusyId(shipmentId);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/${action}`, {
        method: "POST",
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const updated = json.data as Shipment;
      setList((rows) => rows.map((s) => (s.id === updated.id ? updated : s)));
      setOk(action === "sync" ? "Tracking updated." : "Shipment cancelled.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Shipment action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function openShipmentLabel(shipmentId: string, format: "pdf" | "zpl") {
    setBusyId(shipmentId);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch(
        `/api/shipments/${encodeURIComponent(shipmentId)}/label?format=${format}`,
        {
          headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        },
      );
      if (res.redirected) {
        window.open(res.url, "_blank", "noopener,noreferrer");
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(json.error ?? res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not open shipment label");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipments"
        description="Track carrier movement, milestones, and exceptions."
      />

      {!loading && err ? (
        <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-error)]/25 bg-[color:var(--color-error)]/12 p-3 text-sm text-[color:var(--color-error)] shadow-none">
          {err}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-callout-success-border)] bg-[color:var(--color-callout-success-bg)] p-3 text-sm text-[color:var(--color-callout-success-text)] shadow-none">
          {ok}
        </p>
      ) : null}

      <div className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-none">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="From"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                setFromDate(today);
                setToDate(today);
              }}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 1);
                const yesterday = d.toISOString().slice(0, 10);
                setFromDate(yesterday);
                setToDate(yesterday);
              }}
            >
              Yesterday
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="text-base">Active shipments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TableWrap className="rounded-none border-0 shadow-none [&_table]:min-w-0">
              <thead>
                <tr>
                  <Th>AWB / ID</Th>
                  <Th>Carrier</Th>
                  <Th>Status</Th>
                  <Th>Carrier status</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <Tr key={i}>
                      <Td>
                        <Skeleton className="h-4 w-24" />
                      </Td>
                      <Td>
                        <Skeleton className="h-4 w-20" />
                      </Td>
                      <Td>
                        <Skeleton className="h-4 w-16" />
                      </Td>
                    </Tr>
                  ))
                ) : list.length === 0 ? (
                  <Tr>
                    <Td colSpan={4} className="text-center text-[color:var(--color-text-muted)]">
                      No shipments yet
                    </Td>
                  </Tr>
                ) : (
                  list.map((s) => (
                    <Tr
                      key={s.id}
                      className={cn(
                        selectedId === s.id && "bg-[color:var(--color-muted-bg)]/50",
                      )}
                    >
                      <Td>
                        <button
                          type="button"
                          className="text-start font-mono text-xs text-[color:var(--color-primary)] hover:underline"
                          onClick={() => setSelectedId(s.id)}
                        >
                          {s.awb || s.id.slice(0, 10)}
                        </button>
                      </Td>
                      <Td>{carrierLabel(s)}</Td>
                      <Td className={cn("font-medium capitalize", statusStyle(s.status))}>
                        {s.status.replace("_", " ")}
                      </Td>
                      <Td className="text-xs">
                        {s.carrierTrackingStatus ?? "—"}
                      </Td>
                    </Tr>
                  ))
                )}
              </tbody>
            </TableWrap>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shipment detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[75%]" />
                  <Skeleton className="h-24 w-full rounded-[var(--ds-radius-md)]" />
                </div>
              ) : !selected ? (
                <p className="text-[color:var(--color-text-muted)]">
                  Select a shipment from the list.
                </p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-[color:var(--color-text-muted)]">AWB</p>
                      <p className="font-mono font-medium">{selected.awb}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[color:var(--color-text-muted)]">Order</p>
                      <Link
                        href={`/orders/${selected.order_id}`}
                        className="font-mono text-xs text-[color:var(--color-primary)] hover:underline"
                      >
                        {selected.order_id}
                      </Link>
                    </div>
                    <div>
                      <p className="text-xs text-[color:var(--color-text-muted)]">Carrier</p>
                      <p>{carrierLabel(selected)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[color:var(--color-text-muted)]">Carrier fees</p>
                      <p className="tabular-nums">{formatCarrierFee(selected.shipping_fees)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[color:var(--color-text-muted)]">Carrier status</p>
                      <p>{selected.carrierTrackingStatus ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[color:var(--color-text-muted)]">Last sync</p>
                      <p>
                        {formatDateTime(selected.lastTrackingSyncAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[color:var(--color-text-muted)]">Created by</p>
                      <p>{selected.createdByUserName ?? selected.createdByUserId ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[color:var(--color-text-muted)]">Created at</p>
                      <p>{formatDateTime(selected.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      loading={busyId === selected.id}
                      onClick={() => postShipmentAction(selected.id, "sync")}
                    >
                      Refresh carrier status
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      loading={busyId === selected.id}
                      disabled={selected.status === "cancelled"}
                      onClick={() => postShipmentAction(selected.id, "cancel")}
                    >
                      Cancel waybill
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      loading={busyId === selected.id}
                      onClick={() => void openShipmentLabel(selected.id, "pdf")}
                    >
                      Print PDF
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      loading={busyId === selected.id}
                      onClick={() => void openShipmentLabel(selected.id, "zpl")}
                    >
                      Print thermal
                    </Button>
                  </div>
                  <div>
                    <p className="mb-2 text-[12px] font-medium text-[color:var(--color-text-muted)]">
                      Tracking timeline
                    </p>
                    <ul className="space-y-3 border-s-2 border-[color:var(--color-divider)] ps-4">
                      {timeline.map((ev, i) => (
                        <li key={i} className="relative">
                          <span className="absolute -start-[21px] top-1.5 size-2 rounded-full bg-[color:var(--color-primary)] shadow-none" />
                          <p className="font-medium">{ev.label}</p>
                          {ev.at ? (
                            <p className="text-xs text-[color:var(--color-text-muted)]">
                              {new Date(ev.at).toLocaleString("en-US")}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Route map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-56 items-center justify-center rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] text-center text-sm text-[color:var(--color-text-muted)]">
                Interactive map placeholder — connect Mapbox or Google Maps with
                route polyline.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
