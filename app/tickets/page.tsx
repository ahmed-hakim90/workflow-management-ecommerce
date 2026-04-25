"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { TableWrap, Th, Tr, Td } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { ResponsiveCard } from "@/components/responsive/ResponsiveCard";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { useUiStore } from "@/store/zustand/ui-store";
import type { Ticket, TicketStatus, TicketType } from "@/lib/types/models";
import { TicketStatusBadge, TicketTypeBadge } from "@/lib/ui/order-badges";

export default function TicketsPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const openDrawer = useUiStore((s) => s.openDrawer);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [orderId, setOrderId] = useState("");
  const [ticketType, setTicketType] = useState<TicketType>("complaint");
  const [fStatus, setFStatus] = useState<TicketStatus | "">("");
  const [fType, setFType] = useState<TicketType | "">("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function refresh() {
    setErr(null);
    const params = new URLSearchParams();
    if (fStatus) params.set("status", fStatus);
    const res = await fetch(`/api/tickets?${params}`, {
      headers: buildAuthHeaders({ apiSecret, tenantId, userId, role }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? res.statusText);
    let list = json.data as Ticket[];
    if (fType) list = list.filter((t) => t.type === fType);
    setTickets(list);
  }

  useEffect(() => {
    refresh().catch((e) => setErr(e instanceof Error ? e.message : "Error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiSecret, tenantId, userId, role, fStatus, fType]);

  async function createTicket() {
    setErr(null);
    setOk(null);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: buildAuthHeaders({ apiSecret, tenantId, userId, role }),
        body: JSON.stringify({
          order_id: orderId,
          type: ticketType,
          notes: "Created from UI",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setOrderId("");
      setOk("تم إنشاء التذكرة.");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }

  async function assignTicket(ticketId: string) {
    const assignee = window.prompt("معرّف المستخدم للتعيين؟");
    if (!assignee) return;
    setErr(null);
    try {
      const res = await fetch("/api/tickets/assign", {
        method: "POST",
        headers: buildAuthHeaders({ apiSecret, tenantId, userId, role }),
        body: JSON.stringify({ ticketId, assigneeUserId: assignee }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setOk("تم التعيين.");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }

  function openTicketDrawer(t: Ticket) {
    openDrawer("تفاصيل التذكرة", () => (
      <div className="space-y-2 text-sm">
        <div className="font-mono text-xs break-all">{t.id}</div>
        <div>طلب: {t.order_id}</div>
        <div className="flex flex-wrap gap-2">
          <TicketTypeBadge type={t.type} />
          <TicketStatusBadge status={t.status} />
        </div>
        {t.notes ? (
          <p className="text-[color:var(--color-text-secondary)]">{t.notes}</p>
        ) : null}
      </div>
    ));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="التذاكر"
        description="جدول، فلاتر، وتفاصيل في لوحة جانبية."
        actions={
          <Button type="button" size="sm" variant="secondary">
            <Plus className="size-4" aria-hidden />
            تذكرة جديدة
          </Button>
        }
      />

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-lg border border-[color:var(--color-callout-success-border)] bg-[color:var(--color-callout-success-bg)] p-3 text-sm text-[color:var(--color-callout-success-text)]">
          {ok}
        </p>
      ) : null}

      <div className="grid gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-[var(--shadow-card)] md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs text-[color:var(--color-text-secondary)]">معرّف الطلب</label>
          <Input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="UUID"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[color:var(--color-text-secondary)]">النوع</label>
          <Select
            value={ticketType}
            onChange={(e) => setTicketType(e.target.value as TicketType)}
          >
            <option value="complaint">شكوى</option>
            <option value="return">إرجاع</option>
            <option value="exchange">استبدال</option>
          </Select>
        </div>
        <div className="flex items-end md:col-span-2 lg:col-span-1">
          <Button
            type="button"
            onClick={createTicket}
            disabled={!orderId.trim()}
            className="w-full md:w-auto"
          >
            إنشاء
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-[var(--shadow-card)] sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1">
          <label className="text-xs text-[color:var(--color-text-secondary)]">حالة</label>
          <Select
            value={fStatus}
            onChange={(e) =>
              setFStatus(e.target.value as TicketStatus | "")
            }
          >
            <option value="">الكل</option>
            <option value="open">open</option>
            <option value="in_progress">in_progress</option>
            <option value="resolved">resolved</option>
            <option value="closed">closed</option>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[color:var(--color-text-secondary)]">النوع</label>
          <Select
            value={fType}
            onChange={(e) => setFType(e.target.value as TicketType | "")}
          >
            <option value="">الكل</option>
            <option value="complaint">complaint</option>
            <option value="return">return</option>
            <option value="exchange">exchange</option>
          </Select>
        </div>
      </div>

      <ResponsiveTable
        desktop={
          <TableWrap>
            <thead>
              <tr>
                <Th>التذكرة</Th>
                <Th>الطلب</Th>
                <Th>النوع</Th>
                <Th>الحالة</Th>
                <Th>إجراءات</Th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <Tr>
                  <Td colSpan={5} className="text-center text-[color:var(--color-text-muted)]">
                    لا تذاكر
                  </Td>
                </Tr>
              ) : (
                tickets.map((t) => (
                  <Tr key={t.id}>
                    <Td className="font-mono text-xs">{t.id.slice(0, 10)}…</Td>
                    <Td className="font-mono text-xs">
                      {t.order_id.slice(0, 10)}…
                    </Td>
                    <Td>
                      <TicketTypeBadge type={t.type} />
                    </Td>
                    <Td>
                      <TicketStatusBadge status={t.status} />
                    </Td>
                    <Td className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openTicketDrawer(t)}
                      >
                        تفاصيل
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => assignTicket(t.id)}
                      >
                        تعيين
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
            {tickets.length === 0 ? (
              <p className="text-center text-sm text-[color:var(--color-text-muted)]">
                لا تذاكر
              </p>
            ) : (
              tickets.map((t) => (
                <ResponsiveCard key={t.id}>
                  <div className="space-y-3 text-sm">
                    <div className="font-mono text-xs text-[color:var(--color-text-muted)]">
                      {t.id.slice(0, 12)}…
                    </div>
                    <div className="text-[color:var(--color-text-secondary)]">
                      طلب:{" "}
                      <span className="font-mono text-[color:var(--color-text-primary)]">
                        {t.order_id.slice(0, 12)}…
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <TicketTypeBadge type={t.type} />
                      <TicketStatusBadge status={t.status} />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => openTicketDrawer(t)}
                      >
                        التفاصيل
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => assignTicket(t.id)}
                      >
                        تعيين
                      </Button>
                    </div>
                  </div>
                </ResponsiveCard>
              ))
            )}
          </div>
        }
      />
    </div>
  );
}
