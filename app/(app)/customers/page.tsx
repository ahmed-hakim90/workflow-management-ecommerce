"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { can } from "@/lib/auth/rbac";
import type { ChatConversation } from "@/lib/types/chat";
import type { Order, Shipment, Ticket } from "@/lib/types/models";
import { OrderStatusBadge } from "@/lib/ui/order-badges";

type ProfileResponse = {
  phone: string;
  conversation: ChatConversation | null;
  orders: Order[];
  cancelCount: number;
  returnCount: number;
  lastAddress: string | null;
  lastOrderAt: string | null;
  tickets: Ticket[];
  shipments: Shipment[];
  riskScore: number;
};

function displayWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function CustomersPageContent() {
  const searchParams = useSearchParams();
  const initialPhone = searchParams.get("phone")?.trim() ?? "";

  const session = useSessionStore();
  const headers = useMemo(() => buildAuthHeaders(session), [session]);
  const subject = useMemo(
    () => ({ role: session.role, permissions: session.permissions }),
    [session.role, session.permissions],
  );
  const canRead = can(subject, "order:read");

  const [phoneInput, setPhoneInput] = useState(initialPhone);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(
    async (phone: string) => {
      if (!canRead || !phone.trim()) {
        setProfile(null);
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(
          `/api/customers/profile?phone=${encodeURIComponent(phone.trim())}`,
          { headers },
        );
        const json = (await res.json()) as { data?: ProfileResponse; error?: string };
        if (!res.ok) throw new Error(json.error || res.statusText);
        setProfile(json.data ?? null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Error");
        setProfile(null);
      } finally {
        setLoading(false);
      }
    },
    [canRead, headers],
  );

  useEffect(() => {
    if (initialPhone) {
      setPhoneInput(initialPhone);
      void load(initialPhone);
    }
  }, [initialPhone, load]);

  if (!canRead) {
    return (
      <div className="p-6">
        <PageHeader title="Customers" description="Order access required." />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Customers"
        description="Orders and WhatsApp thread by phone (OMS source of truth)."
      />

      <Card>
        <CardContent className="flex flex-wrap gap-2 py-4">
          <Input
            placeholder="Phone (e.g. +2010…)"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="max-w-sm"
          />
          <Button
            type="button"
            variant="primary"
            disabled={loading || !phoneInput.trim()}
            onClick={() => void load(phoneInput)}
          >
            {loading ? "Loading…" : "Search"}
          </Button>
        </CardContent>
      </Card>

      {err ? (
        <p className="text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}

      {profile ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-[color:var(--color-text-muted)]">Phone:</span>{" "}
                <span className="font-mono">{profile.phone}</span>
              </p>
              <p>
                <span className="text-[color:var(--color-text-muted)]">Orders:</span>{" "}
                {profile.orders.length}
              </p>
              <p>
                <span className="text-[color:var(--color-text-muted)]">Cancelled:</span>{" "}
                {profile.cancelCount}
              </p>
              <p>
                <span className="text-[color:var(--color-text-muted)]">Returns / exchange:</span>{" "}
                {profile.returnCount}
              </p>
              <p>
                <span className="text-[color:var(--color-text-muted)]">Risk score:</span>{" "}
                <span className="tabular-nums font-medium">{profile.riskScore}</span>
                <span className="text-[color:var(--color-text-muted)]"> / 100</span>
                <span className="ms-2 text-xs text-[color:var(--color-text-muted)]">
                  (cancellations × 14 + returns × 12 + open tickets × 10, capped)
                </span>
              </p>
              <p>
                <span className="text-[color:var(--color-text-muted)]">Last address:</span>{" "}
                {profile.lastAddress ?? "—"}
              </p>
              <p>
                <span className="text-[color:var(--color-text-muted)]">Last order:</span>{" "}
                {displayWhen(profile.lastOrderAt)}
              </p>
              {profile.conversation ? (
                <div className="pt-2">
                  <Link
                    href="/inbox"
                    className="text-sm font-medium text-[color:var(--color-primary)] underline-offset-2 hover:underline"
                  >
                    Open Inbox — select thread for this number
                  </Link>
                  <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                    Conversation ID: {profile.conversation.id} · status:{" "}
                    {profile.conversation.status}
                  </p>
                </div>
              ) : (
                <p className="pt-2 text-xs text-[color:var(--color-text-muted)]">
                  No WhatsApp conversation yet for this normalized phone.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tickets ({profile.tickets.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {profile.tickets.length === 0 ? (
                <p className="text-sm text-[color:var(--color-text-muted)]">
                  No tickets on linked orders.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {profile.tickets.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-border-subtle)] p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs">{t.id.slice(0, 8)}</span>
                        <span className="text-xs capitalize text-[color:var(--color-text-muted)]">
                          {t.status} · {t.type}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                        Order:{" "}
                        <Link
                          href={`/orders/${t.order_id}`}
                          className="text-[color:var(--color-primary)] hover:underline"
                        >
                          {t.order_id.slice(0, 8)}
                        </Link>
                        {" · "}
                        {displayWhen(t.updatedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipments ({profile.shipments.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {profile.shipments.length === 0 ? (
                <p className="text-sm text-[color:var(--color-text-muted)]">
                  No shipments on recent orders.
                </p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                  {profile.shipments.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-border-subtle)] p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs">{s.awb}</span>
                        <span className="text-xs capitalize">{s.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                        {s.type} ·{" "}
                        <Link
                          href={`/orders/${s.order_id}`}
                          className="text-[color:var(--color-primary)] hover:underline"
                        >
                          order
                        </Link>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {profile.orders.length === 0 ? (
                <p className="text-sm text-[color:var(--color-text-muted)]">No orders.</p>
              ) : (
                <ul className="space-y-2">
                  {profile.orders.map((o) => (
                    <li
                      key={o.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--ds-radius-md)] border border-[color:var(--color-border-subtle)] p-3 text-sm"
                    >
                      <div className="space-y-1">
                        <Link
                          href={`/orders/${o.id}`}
                          className="font-medium text-[color:var(--color-primary)] hover:underline"
                        >
                          {o.wooCommerceOrderId?.trim() || o.id.slice(0, 8)}
                        </Link>
                        <p className="text-xs text-[color:var(--color-text-muted)]">
                          {displayWhen(o.createdAt)}
                        </p>
                      </div>
                      <OrderStatusBadge status={o.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[color:var(--color-text-muted)]">
          Loading…
        </div>
      }
    >
      <CustomersPageContent />
    </Suspense>
  );
}
