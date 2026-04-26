"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableWrap, Th, Tr, Td } from "@/components/ui/table";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import type { Shipment, ShipmentStatus } from "@/lib/types/models";
import { cn } from "@/lib/ui/cn";

function carrierLabel(s: Shipment) {
  if (s.provider === "bosta") return "Bosta";
  return "Demo carrier";
}

function statusStyle(st: ShipmentStatus) {
  if (st === "delivered") return "text-[color:var(--color-success)]";
  if (st === "shipped" || st === "packed") return "text-[color:var(--color-primary)]";
  if (st === "failed" || st === "cancelled")
    return "text-[color:var(--color-error)]";
  return "text-[color:var(--color-text-secondary)]";
}

export default function ShipmentsPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);

  const [list, setList] = useState<Shipment[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/shipments", {
          headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        const rows = json.data as Shipment[];
        if (!cancelled) {
          setList(rows);
          setSelectedId((id) => id ?? rows[0]?.id ?? null);
        }
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Failed to load shipments");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiSecret, idToken, tenantId, userId, role]);

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
    return items;
  }, [selected]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipments"
        description="Track carrier movement, milestones, and exceptions."
      />

      {err ? (
        <p className="rounded-xl bg-[color:var(--color-error)]/12 p-3 text-sm text-[color:var(--color-error)] shadow-[var(--shadow-neo-raised-sm)]">
          {err}
        </p>
      ) : null}

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
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <Tr>
                    <Td colSpan={3} className="text-center text-[color:var(--color-text-muted)]">
                      Loading…
                    </Td>
                  </Tr>
                ) : list.length === 0 ? (
                  <Tr>
                    <Td colSpan={3} className="text-center text-[color:var(--color-text-muted)]">
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
              {!selected ? (
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
                      <p className="font-mono text-xs break-all">{selected.order_id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[color:var(--color-text-muted)]">Carrier</p>
                      <p>{carrierLabel(selected)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[color:var(--color-text-muted)]">Fees</p>
                      <p className="tabular-nums">
                        {(selected.shipping_fees ?? 0).toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                        })}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                      Tracking timeline
                    </p>
                    <ul className="space-y-3 border-s-2 border-[color:var(--color-divider)] ps-4">
                      {timeline.map((ev, i) => (
                        <li key={i} className="relative">
                          <span className="absolute -start-[21px] top-1.5 size-2 rounded-full bg-[color:var(--color-primary)] shadow-[var(--shadow-neo-raised-sm)]" />
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
              <div className="flex h-56 items-center justify-center rounded-xl bg-[color:var(--color-bg-subtle)] text-center text-sm text-[color:var(--color-text-muted)] shadow-[var(--shadow-neo-inset)]">
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
