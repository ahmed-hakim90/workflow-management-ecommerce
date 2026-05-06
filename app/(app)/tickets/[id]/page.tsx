"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, PackagePlus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { can } from "@/lib/auth/rbac";
import type { ActivityLog, Order, Shipment, Ticket, User } from "@/lib/types/models";
import {
  OrderStatusBadge,
  PaymentBadge,
  TicketStatusBadge,
  TicketTypeBadge,
} from "@/lib/ui/order-badges";

type TicketBundle = {
  ticket: Ticket;
  order: Order | null;
  shipments: Shipment[];
  activities: ActivityLog[];
  users: User[];
};

type ResolutionAction =
  | "resolved"
  | "return"
  | "exchange"
  | "refund_without_shipment";

function formatWhen(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatMoney(value: number) {
  return value.toLocaleString("ar-EG-u-nu-latn", {
    style: "currency",
    currency: "EGP",
  });
}

function displayOrderId(order: Order) {
  return order.wooCommerceOrderId?.trim() || order.id.slice(0, 8).toUpperCase();
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
        {label}
      </p>
      <div className="text-sm text-[color:var(--color-text-primary)]">{children}</div>
    </div>
  );
}

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const permissions = useSessionStore((s) => s.permissions);
  const authReady = useSessionStore((s) => s.authReady);

  const [bundle, setBundle] = useState<TicketBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [resolutionAction, setResolutionAction] =
    useState<ResolutionAction>("resolved");
  const [resolutionDetails, setResolutionDetails] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAssigneeUserId, setSelectedAssigneeUserId] = useState("");
  const [busy, setBusy] = useState(false);

  const headers = useMemo(
    () => buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
    [apiSecret, idToken, tenantId, userId, role],
  );
  const permissionSubject = { role, permissions };
  const canWorkTicket = can(permissionSubject, "ticket:resolve");
  const canAssignTicket = can(permissionSubject, "ticket:assign");
  const canDeleteTicket = role === "admin" && can(permissionSubject, "ticket:delete");
  const canViewFinance = can(permissionSubject, "finance:view");

  const userName = useCallback(
    (id?: string | null) =>
      id ? bundle?.users.find((u) => u.id === id)?.name ?? id : "—",
    [bundle?.users],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setBundle(json.data as TicketBundle);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load ticket");
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [headers, ticketId]);

  useEffect(() => {
    if (!authReady) return;
    void load();
  }, [authReady, load]);

  async function postJson(url: string, body: object) {
    setErr(null);
    setMsg(null);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? res.statusText);
    return json.data;
  }

  async function addNote() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await postJson(`/api/tickets/${ticketId}/notes`, { body: note.trim() });
      setNote("");
      setMsg("تمت إضافة الملاحظة.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add note");
    } finally {
      setBusy(false);
    }
  }

  function openAssignModal() {
    setSelectedAssigneeUserId(bundle?.ticket.assigned_to ?? "");
    setAssignModalOpen(true);
  }

  async function assignTicket() {
    setBusy(true);
    try {
      await postJson("/api/tickets/assign", {
        ticketId,
        assigneeUserId: selectedAssigneeUserId || null,
      });
      setMsg("تم تحديث التعيين.");
      setAssignModalOpen(false);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to assign ticket");
    } finally {
      setBusy(false);
    }
  }

  async function resolveTicket() {
    const order = bundle?.order;
    const refundAmount =
      resolutionAction === "refund_without_shipment"
        ? order?.payment.total_amount ?? 0
        : undefined;
    setBusy(true);
    try {
      await postJson("/api/tickets/resolve", {
        ticketId,
        resolutionKind: resolutionAction,
        resolutionDetails: resolutionDetails.trim() || undefined,
        refundAmount,
        createShipmentType:
          resolutionAction === "return" || resolutionAction === "exchange"
            ? resolutionAction
            : undefined,
      });
      setMsg("تم حل التذكرة.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to resolve ticket");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCurrentTicket() {
    if (!canDeleteTicket || busy) return;
    const confirmed = window.confirm(
      "Delete this ticket? This cannot be undone.",
    );
    if (!confirmed) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      router.push("/tickets");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete ticket");
    } finally {
      setBusy(false);
    }
  }

  const ticket = bundle?.ticket;
  const order = bundle?.order;

  return (
    <div className="space-y-6">
      <PageHeader
        title={ticket ? `Ticket #${ticket.id.slice(0, 8).toUpperCase()}` : "Ticket detail"}
        description={
          ticket
            ? `Created ${formatWhen(ticket.createdAt)} · Updated ${formatWhen(ticket.updatedAt)}`
            : "Review the customer issue, order context, and resolution actions."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canDeleteTicket && ticket ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={busy}
                onClick={() => void deleteCurrentTicket()}
              >
                <Trash2 className="size-4" aria-hidden />
                Delete
              </Button>
            ) : null}
            <Link href="/tickets">
              <Button type="button" variant="secondary" size="sm">
                <ArrowLeft className="size-4" aria-hidden />
                Tickets
              </Button>
            </Link>
          </div>
        }
      />

      {!loading && err ? (
        <p className="rounded-xl bg-[color:var(--color-error)]/12 p-3 text-sm text-[color:var(--color-error)] shadow-[var(--shadow-neo-raised-sm)]">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-xl bg-[color:var(--color-callout-success-bg)] p-3 text-sm text-[color:var(--color-callout-success-text)] shadow-[var(--shadow-neo-raised-sm)]">
          {msg}
        </p>
      ) : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : ticket ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>تفاصيل التذكرة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <TicketStatusBadge status={ticket.status} />
                  <TicketTypeBadge type={ticket.type} />
                  {ticket.resolution ? (
                    <Badge tone="success">{ticket.resolution.kind}</Badge>
                  ) : null}
                </div>
                <Detail label="كلام العميل">
                  <div className="rounded-xl bg-[color:var(--color-bg-subtle)] p-3 shadow-[var(--shadow-neo-inset)]">
                    {ticket.notes ?? "—"}
                  </div>
                </Detail>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Assigned to">
                    {userName(ticket.assigned_to)}
                  </Detail>
                  <Detail label="Shipments from ticket">
                    {ticket.shipmentIds.length}
                  </Detail>
                </div>
                {ticket.resolution ? (
                  <Detail label="Resolution">
                    <div className="rounded-xl bg-[color:var(--color-success)]/10 p-3">
                      {ticket.resolution.details || ticket.resolution.kind}
                      {ticket.resolution.refundAmount != null
                        ? ` · ${formatMoney(ticket.resolution.refundAmount)}`
                        : ""}
                      <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                        By {userName(ticket.resolution.resolvedByUserId)} ·{" "}
                        {formatWhen(ticket.resolution.resolvedAt)}
                      </div>
                    </div>
                  </Detail>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>تفاصيل الطلب</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <OrderStatusBadge status={order.status} />
                      <PaymentBadge status={order.payment.payment_status} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Detail label="Order">
                        <Link
                          href={`/orders/${order.id}`}
                          className="font-mono text-[color:var(--color-primary)] hover:underline"
                        >
                          #{displayOrderId(order)}
                        </Link>
                      </Detail>
                      <Detail label="Customer">{order.customer.name}</Detail>
                      <Detail label="Phone">{order.customer.phone ?? "—"}</Detail>
                      <Detail label="Total">
                        {canViewFinance
                          ? formatMoney(order.payment.total_amount)
                          : "Hidden"}
                      </Detail>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[color:var(--color-text-muted)]">
                    Order not found.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>الشغل على التذكرة</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <textarea
                  className="min-h-28 w-full rounded-xl border-0 bg-[color:var(--color-input-bg)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] shadow-[var(--shadow-neo-inset)] outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="أضف كلام العميل أو ملاحظة متابعة..."
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={!canWorkTicket || !note.trim()}
                    loading={busy}
                    onClick={addNote}
                  >
                    إضافة ملاحظة
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!canAssignTicket}
                    onClick={openAssignModal}
                  >
                    تعيين / تغيير المسؤول
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                <Select
                  label="قرار التذكرة"
                  value={resolutionAction}
                  onChange={(e) =>
                    setResolutionAction(e.target.value as ResolutionAction)
                  }
                >
                  <option value="resolved">تم حلها فقط</option>
                  <option value="return">طلب استرجاع + إنشاء بوليصة</option>
                  <option value="exchange">استبدال + إنشاء بوليصة</option>
                  <option value="refund_without_shipment">
                    استرجاع كامل بدون بوليصة
                  </option>
                </Select>
                <textarea
                  className="min-h-24 w-full rounded-xl border-0 bg-[color:var(--color-input-bg)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] shadow-[var(--shadow-neo-inset)] outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
                  value={resolutionDetails}
                  onChange={(e) => setResolutionDetails(e.target.value)}
                  placeholder="تفاصيل الحل أو سبب الاسترجاع/الاستبدال..."
                />
                <Button
                  type="button"
                  disabled={!canWorkTicket || ticket.status === "resolved"}
                  loading={busy}
                  onClick={resolveTicket}
                >
                  <PackagePlus className="size-4" aria-hidden />
                  تنفيذ القرار
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>ملاحظات التذكرة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(ticket.notesHistory ?? []).length === 0 ? (
                  <p className="text-sm text-[color:var(--color-text-muted)]">
                    لا توجد ملاحظات إضافية.
                  </p>
                ) : (
                  (ticket.notesHistory ?? []).map((n) => (
                    <div
                      key={n.id}
                      className="rounded-xl bg-[color:var(--color-bg-subtle)] p-3 text-sm shadow-[var(--shadow-neo-inset)]"
                    >
                      <p>{n.body}</p>
                      <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                        {userName(n.userId)} · {formatWhen(n.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>سجل العمل</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {bundle.activities.length === 0 ? (
                  <p className="text-sm text-[color:var(--color-text-muted)]">
                    لا يوجد سجل بعد.
                  </p>
                ) : (
                  bundle.activities.map((a) => (
                    <div key={a.id} className="border-b border-[color:var(--color-divider)] pb-2 text-sm last:border-0">
                      <p className="font-medium">{a.action}</p>
                      <p className="text-xs text-[color:var(--color-text-muted)]">
                        {userName(a.userId)} · {formatWhen(a.timestamp)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>البوالص المرتبطة بالطلب</CardTitle>
            </CardHeader>
            <CardContent>
              {bundle.shipments.length === 0 ? (
                <p className="text-sm text-[color:var(--color-text-muted)]">
                  لا توجد بوالص مرتبطة بالطلب.
                </p>
              ) : (
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>AWB</Th>
                      <Th>Type</Th>
                      <Th>Status</Th>
                      <Th>Bosta</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundle.shipments.map((s) => (
                      <Tr key={s.id}>
                        <Td className="font-mono text-xs">{s.awb}</Td>
                        <Td>{s.type}</Td>
                        <Td>{s.status}</Td>
                        <Td>{s.carrierTrackingStatus ?? "—"}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Modal
        open={assignModalOpen}
        title="اختيار مسؤول التذكرة"
        onClose={() => {
          if (!busy) setAssignModalOpen(false);
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setAssignModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              disabled={!canAssignTicket}
              loading={busy}
              onClick={assignTicket}
            >
              حفظ المسؤول
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Select
            label="المسؤول"
            value={selectedAssigneeUserId}
            onChange={(e) => setSelectedAssigneeUserId(e.target.value)}
            disabled={busy}
          >
            <option value="">بدون مسؤول</option>
            {(bundle?.users ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.role ? ` - ${u.role}` : ""}
                {u.email ? ` - ${u.email}` : ""}
              </option>
            ))}
          </Select>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            اختر مستخدمًا من الفريق بدل إدخال معرف المستخدم يدويًا.
          </p>
        </div>
      </Modal>
    </div>
  );
}
