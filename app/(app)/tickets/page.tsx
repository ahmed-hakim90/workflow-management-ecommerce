"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResponsiveKanban,
  type KanbanColumn,
} from "@/components/responsive/ResponsiveKanban";
import { KanbanSkeleton } from "@/components/ui/skeleton";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { useUiStore } from "@/store/zustand/ui-store";
import type { Order, Ticket, TicketType } from "@/lib/types/models";
import { TicketTypeBadge } from "@/lib/ui/order-badges";
import { cn } from "@/lib/ui/cn";

type ColumnId = "new" | "in_progress" | "pending_response";
type TicketOrderSummary = Pick<Order, "id" | "wooCommerceOrderId" | "customer">;
type TicketListItem = Ticket & { order?: TicketOrderSummary | null };

const COLUMNS: KanbanColumn<ColumnId>[] = [
  {
    id: "new",
    title: "New",
    statusDotClass: "bg-[color:var(--color-primary)]",
  },
  {
    id: "in_progress",
    title: "In progress",
    statusDotClass: "bg-violet-500",
  },
  {
    id: "pending_response",
    title: "Pending response",
    statusDotClass: "bg-orange-500",
  },
];

function columnForTicket(t: Ticket): ColumnId {
  if (t.status === "in_progress") return "in_progress";
  if (t.status === "resolved") return "pending_response";
  if (t.status === "closed") return "pending_response";
  return "new";
}

function priorityForTicket(t: Ticket): "high" | "medium" | "low" {
  if (t.type === "complaint") return "high";
  if (t.type === "return") return "medium";
  return "low";
}

const TYPE_TAG: Record<TicketType, string> = {
  return: "RETURN",
  exchange: "EXCHANGE",
  complaint: "REFUND",
};

function displayOrderId(order: Pick<Order, "id" | "wooCommerceOrderId">) {
  return order.wooCommerceOrderId?.trim() || order.id.slice(0, 8).toUpperCase();
}

function orderSearchText(order: Order) {
  return [
    order.id,
    order.wooCommerceOrderId,
    order.customer.name,
    order.customer.phone,
    order.customer.email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function CreateTicketForm({
  orders,
  onCreate,
}: {
  orders: Order[];
  onCreate: (input: { orderId: string; type: TicketType; notes: string }) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [ticketType, setTicketType] = useState<TicketType>("complaint");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return orders.slice(0, 8);
    return orders.filter((order) => orderSearchText(order).includes(needle)).slice(0, 8);
  }, [orders, query]);

  const selectedOrder = orders.find((order) => order.id === selectedOrderId);

  async function submit() {
    if (!selectedOrderId || submitting) return;
    setSubmitting(true);
    try {
      await onCreate({ orderId: selectedOrderId, type: ticketType, notes });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-1">
        <label className="text-xs text-[color:var(--color-text-muted)]">
          Order ID
        </label>
        <div className="relative">
          <Input
            value={query}
            onFocus={() => setDropdownOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedOrderId("");
              setDropdownOpen(true);
            }}
            placeholder="Search by WooCommerce order ID, customer, or phone"
          />
          {dropdownOpen ? (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl bg-[color:var(--color-card)] p-1 shadow-[var(--shadow-neo-raised)] ring-1 ring-[color:var(--color-border)]">
              {matches.length > 0 ? (
                matches.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-start hover:bg-[color:var(--color-hover-bg)]",
                      selectedOrderId === order.id &&
                        "bg-[color:var(--color-nav-active-bg)] text-[color:var(--color-primary)]",
                    )}
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      setQuery(`#${displayOrderId(order)} — ${order.customer.name}`);
                      setDropdownOpen(false);
                    }}
                  >
                    <div className="font-mono text-xs font-semibold">
                      #{displayOrderId(order)}
                    </div>
                    <div className="truncate text-xs text-[color:var(--color-text-muted)]">
                      {order.customer.name}
                      {order.customer.phone ? ` · ${order.customer.phone}` : ""}
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-[color:var(--color-text-muted)]">
                  No orders found
                </div>
              )}
            </div>
          ) : null}
        </div>
        {selectedOrder ? (
          <p className="text-xs text-[color:var(--color-success)]">
            Selected: #{displayOrderId(selectedOrder)} · {selectedOrder.customer.name}
          </p>
        ) : (
          <p className="text-xs text-[color:var(--color-text-muted)]">
            Select an order from the dropdown.
          </p>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-xs text-[color:var(--color-text-muted)]">
          Type
        </label>
        <Select
          value={ticketType}
          onChange={(e) => setTicketType(e.target.value as TicketType)}
        >
          <option value="complaint">Complaint</option>
          <option value="return">Return</option>
          <option value="exchange">Exchange</option>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-[color:var(--color-text-muted)]">
          Customer says
        </label>
        <textarea
          className="min-h-24 w-full rounded-xl border-0 bg-[color:var(--color-input-bg)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] shadow-[var(--shadow-neo-inset)] outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="اكتب كلام العميل أو سبب التذكرة..."
        />
      </div>
      <Button
        type="button"
        className="w-full"
        disabled={!selectedOrderId || submitting}
        onClick={() => void submit()}
      >
        {submitting ? "Submitting..." : "Submit"}
      </Button>
    </div>
  );
}

export default function TicketsPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const authReady = useSessionStore((s) => s.authReady);
  const openDrawer = useUiStore((s) => s.openDrawer);
  const closeDrawer = useUiStore((s) => s.closeDrawer);

  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<"all" | "mine" | "urgent">("all");

  async function refresh() {
    setErr(null);
    setListLoading(true);
    try {
      const res = await fetch(`/api/tickets?includeOrderSummary=1`, {
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setTickets(json.data as TicketListItem[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    if (!authReady) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, apiSecret, idToken, tenantId, userId, role]);

  async function refreshOrders(): Promise<Order[]> {
    try {
      const res = await fetch("/api/orders?limit=8", {
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
      });
      const json = (await res.json()) as {
        data?: { orders?: Order[] };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const next = json.data?.orders ?? [];
      setOrders(next);
      return next;
    } catch {
      setOrders([]);
      return [];
    }
  }

  const ordersById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tickets.filter((t) => {
      if (t.status === "closed") return false;
      if (chip === "mine" && t.assigned_to !== userId) return false;
      if (chip === "urgent" && priorityForTicket(t) !== "high") return false;
      if (!needle) return true;
      const order = t.order ?? ordersById.get(t.order_id);
      const hay = [
        t.id,
        t.order_id,
        t.notes,
        order?.id,
        order?.wooCommerceOrderId,
        order?.customer.name,
        order?.customer.phone,
        order?.customer.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [tickets, q, chip, userId, ordersById]);

  const byColumn = (id: ColumnId) =>
    visible.filter((t) => columnForTicket(t) === id);

  async function createTicket(input: { orderId: string; type: TicketType; notes: string }) {
    setErr(null);
    setOk(null);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        body: JSON.stringify({
          order_id: input.orderId,
          type: input.type,
          notes: input.notes.trim() || "Created from board",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setOk("Ticket created.");
      closeDrawer();
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }

  async function openCreateDrawer() {
    const latestOrders = await refreshOrders();
    openDrawer("Create ticket", () => (
      <CreateTicketForm
        orders={latestOrders.length > 0 ? latestOrders : orders}
        onCreate={createTicket}
      />
    ));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ticket Management"
        description="Triage support work across new, in-progress, and pending response queues."
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All Tickets"],
              ["mine", "Assigned to Me"],
              ["urgent", "Urgent Only"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setChip(id)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-all",
                chip === id
                  ? "bg-[color:var(--color-nav-active-bg)] text-[color:var(--color-primary)] shadow-[var(--shadow-neo-raised-sm)] ring-1 ring-[color:var(--color-primary)]/25"
                  : "bg-[color:var(--color-card)] text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-raised-sm)] hover:shadow-[var(--shadow-neo-raised)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:flex-initial">
            <Search className="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
            <Input
              className="h-10 ps-8"
              placeholder="Search by customer, phone, or order number…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="gap-1"
            aria-label="Sort (coming soon)"
          >
            Recently updated
            <ChevronDown className="size-4 opacity-70" />
          </Button>
          <Button type="button" onClick={() => void openCreateDrawer()}>
            <Plus className="size-4" aria-hidden />
            Create Ticket
          </Button>
        </div>
      </div>

      {!listLoading && err ? (
        <p className="rounded-xl bg-[color:var(--color-error)]/12 p-3 text-sm text-[color:var(--color-error)] shadow-[var(--shadow-neo-raised-sm)]">
          {err}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-xl bg-[color:var(--color-callout-success-bg)] p-3 text-sm text-[color:var(--color-callout-success-text)] shadow-[var(--shadow-neo-raised-sm)]">
          {ok}
        </p>
      ) : null}

      {listLoading ? (
        <KanbanSkeleton columns={3} cardsPerColumn={3} />
      ) : (
      <ResponsiveKanban<ColumnId>
        columns={COLUMNS}
        countFor={(id) => byColumn(id).length}
        renderColumnCards={(columnId) =>
          byColumn(columnId).map((t) => {
            const pr = priorityForTicket(t);
            const order = t.order ?? ordersById.get(t.order_id);
            return (
              <Card key={t.id} className="shadow-[var(--shadow-neo-raised-sm)]">
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/tickets/${t.id}`}
                      className="font-mono text-xs text-[color:var(--color-primary)] hover:underline"
                    >
                      #{t.id.slice(0, 8).toUpperCase()}
                    </Link>
                    <Badge
                      tone={
                        pr === "high"
                          ? "danger"
                          : pr === "medium"
                            ? "warning"
                            : "default"
                      }
                    >
                      {pr.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold leading-snug">
                    <Link href={`/tickets/${t.id}`} className="hover:underline">
                      {t.notes?.slice(0, 80) || `Ticket for order ${t.order_id.slice(0, 8)}…`}
                    </Link>
                  </p>
                  <p className="text-xs text-[color:var(--color-text-muted)] line-clamp-2">
                    {order?.customer.name ?? "Unknown customer"} · Order{" "}
                    <span className="font-mono">
                      {order ? displayOrderId(order) : t.order_id.slice(0, 8)}
                    </span>
                    {order?.customer.phone ? ` · ${order.customer.phone}` : ""}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="rounded-md bg-[color:var(--color-muted-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-inset)]">
                      {TYPE_TAG[t.type]}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-[color:var(--color-text-muted)]">
                      <span className="flex size-7 items-center justify-center rounded-full bg-[color:var(--color-primary)]/15 text-[10px] font-bold text-[color:var(--color-primary)]">
                        {(t.assigned_to ?? "NA").slice(0, 2).toUpperCase()}
                      </span>
                      <TicketTypeBadge type={t.type} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        }
      />
      )}
    </div>
  );
}
