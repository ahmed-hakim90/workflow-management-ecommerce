"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Lock } from "lucide-react";
import type { DragEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge, PaymentBadge } from "@/lib/ui/order-badges";
import { defaultKanbanSettings } from "@/lib/kanban/column";
import {
  allowedNextStatuses,
  TransitionBlockedError,
} from "@/lib/logic/order-state-machine";
import {
  statusRequiresAwb,
  statusRequiresInvoice,
  statusLabel,
} from "@/lib/logic/order-status-meta";
import {
  ORDER_ACTIONS,
  type OrderActionId,
} from "@/lib/logic/order-actions";
import type { Order, OrderStatus, TenantKanbanSettings } from "@/lib/types/models";
import { can, type PermissionSubject } from "@/lib/auth/rbac";
import { cn } from "@/lib/ui/cn";

const DRAG_MIME = "application/x-store-order-id";

type OrdersKanbanBoardProps = {
  orders: Order[];
  subject: PermissionSubject;
  headers: Record<string, string>;
  /** Optional tenant-customised columns. Falls back to default 9-column layout. */
  settings?: TenantKanbanSettings | null;
  /** Called when a transition succeeds; lets the page re-merge the order. */
  onOrderUpdated?: (order: Order) => void;
  className?: string;
};

type DropContext = {
  order: Order;
  toStatus: OrderStatus;
  primaryActionId: OrderActionId | null;
};

function statusOptionsForColumn(
  statuses: OrderStatus[],
  fromStatus: OrderStatus,
): OrderStatus | null {
  for (const s of statuses) {
    if (allowedNextStatuses(fromStatus).includes(s)) return s;
  }
  return statuses[0] ?? null;
}

function actionForStatus(
  toStatus: OrderStatus,
): OrderActionId | null {
  return ORDER_ACTIONS.find((a) => a.toStatus === toStatus)?.id ?? null;
}

function blockReasonForOrder(
  order: Order,
  toStatus: OrderStatus,
): string | null {
  if (statusRequiresInvoice(toStatus) && !order.invoice?.number) {
    return "ينقص رقم الفاتورة قبل ما الطلب يطلع للشحن.";
  }
  if (
    statusRequiresAwb(toStatus) &&
    (!order.shipmentIds?.length || !order.latestShipmentAwb?.trim())
  ) {
    return "لازم تنشئ بوليصة شحن (AWB) الأول.";
  }
  return null;
}

export function OrdersKanbanBoard({
  orders,
  subject,
  headers,
  settings,
  onOrderUpdated,
  className,
}: OrdersKanbanBoardProps) {
  const cols = (settings?.columns?.length
    ? settings.columns
    : defaultKanbanSettings().columns
  );

  const grouped = useMemo(() => {
    const map: Record<string, Order[]> = {};
    for (const c of cols) map[c.id] = [];
    for (const o of orders) {
      const col = cols.find((c) => c.statuses.includes(o.status));
      if (col) map[col.id].push(o);
    }
    return map;
  }, [cols, orders]);

  const [drop, setDrop] = useState<DropContext | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragHover, setDragHover] = useState<string | null>(null);

  function handleDragStart(e: DragEvent<HTMLDivElement>, orderId: string) {
    e.dataTransfer.setData(DRAG_MIME, orderId);
    e.dataTransfer.effectAllowed = "move";
  }

  function findOrderById(id: string) {
    return orders.find((o) => o.id === id);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, columnId: string) {
    e.preventDefault();
    setDragHover(null);
    const orderId = e.dataTransfer.getData(DRAG_MIME);
    if (!orderId) return;
    const order = findOrderById(orderId);
    const column = cols.find((c) => c.id === columnId);
    if (!order || !column) return;
    const toStatus = statusOptionsForColumn(column.statuses, order.status);
    if (!toStatus || toStatus === order.status) return;
    if (!allowedNextStatuses(order.status).includes(toStatus)) {
      setErr(`غير مسموح: ${order.status} → ${toStatus}`);
      return;
    }
    setDrop({
      order,
      toStatus,
      primaryActionId: actionForStatus(toStatus),
    });
    setNote("");
    setErr(null);
  }

  async function confirmTransition() {
    if (!drop) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch("/api/orders/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          orderId: drop.order.id,
          actionId: drop.primaryActionId ?? undefined,
          toStatus: drop.primaryActionId ? undefined : drop.toStatus,
          note: note.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: Order;
        error?: string;
        reason?: TransitionBlockedError["reason"];
      };
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error ?? "تعذّر تحديث حالة الطلب");
      }
      onOrderUpdated?.(json.data);
      setDrop(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  const action = drop?.primaryActionId
    ? ORDER_ACTIONS.find((a) => a.id === drop.primaryActionId)
    : null;
  const block = drop ? blockReasonForOrder(drop.order, drop.toStatus) : null;
  const noteRequired = action?.requiresNote ?? false;
  const hasPermission = action ? can(subject, action.permission) : true;

  return (
    <>
      <div
        className={cn(
          "flex gap-3 overflow-x-auto pb-3",
          className,
        )}
        role="list"
        aria-label="Orders Kanban board"
      >
        {cols.map((col) => {
          const isHover = dragHover === col.id;
          return (
            <div
              key={col.id}
              role="listitem"
              onDragOver={(e) => {
                e.preventDefault();
                setDragHover(col.id);
              }}
              onDragLeave={() => setDragHover((cur) => (cur === col.id ? null : cur))}
              onDrop={(e) => handleDrop(e, col.id)}
              className={cn(
                "flex w-[280px] shrink-0 flex-col rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-none transition-colors",
                isHover &&
                  "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/[0.04]",
              )}
            >
              <header className="flex items-center justify-between gap-2 border-b border-[color:var(--color-divider)] px-3 py-2">
                <h3 className="truncate text-sm font-semibold text-[color:var(--color-text-primary)]">
                  {col.title}
                </h3>
                <Badge tone="default" className="shrink-0">
                  {grouped[col.id]?.length ?? 0}
                </Badge>
              </header>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {(grouped[col.id] ?? []).map((o) => (
                  <div
                    key={o.id}
                    draggable
                    onDragStart={(e: DragEvent<HTMLDivElement>) =>
                      handleDragStart(e, o.id)
                    }
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <Card>
                      <CardContent className="space-y-2 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            href={`/orders/${o.id}`}
                            className="truncate font-mono text-[11px] font-semibold text-[color:var(--color-primary)] hover:underline"
                          >
                            #{o.wooCommerceOrderId?.trim() ||
                              o.id.slice(0, 8).toUpperCase()}
                          </Link>
                          {o.wooCommerceOrderAdminUrl ? (
                            <a
                              href={o.wooCommerceOrderAdminUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[color:var(--color-primary)] hover:text-[color:var(--color-text-primary)]"
                              aria-label="Open in WooCommerce"
                            >
                              <ExternalLink className="size-3" aria-hidden />
                            </a>
                          ) : null}
                        </div>
                        <div className="truncate text-sm font-medium text-[color:var(--color-text-primary)]">
                          {o.customer.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <OrderStatusBadge status={o.status} />
                          <PaymentBadge status={o.payment.payment_status} />
                          {!o.invoice?.number &&
                          statusRequiresInvoice(o.status) ? (
                            <Badge tone="warning" className="gap-1">
                              <Lock className="size-3" aria-hidden /> فاتورة
                            </Badge>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
                {(grouped[col.id]?.length ?? 0) === 0 ? (
                  <div className="flex h-16 items-center justify-center rounded-[var(--ds-radius-md)] border border-dashed border-[color:var(--color-border)] text-xs text-[color:var(--color-text-muted)]">
                    اسحب طلب هنا
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {err ? (
        <p className="mt-2 rounded-[var(--ds-radius-md)] border border-[color:var(--color-error)]/30 bg-[color:var(--color-error)]/10 p-2 text-sm text-[color:var(--color-error)]">
          {err}
        </p>
      ) : null}

      {drop ? (
        <Modal
          open
          onClose={() => (submitting ? undefined : setDrop(null))}
          title={
            action
              ? `${action.label_ar} — ${statusLabel(drop.toStatus, "ar")}`
              : `تحويل إلى ${statusLabel(drop.toStatus, "ar")}`
          }
        >
          <div className="space-y-3 p-1 text-sm">
            <p>
              نقل الطلب من{" "}
              <strong>{statusLabel(drop.order.status, "ar")}</strong> إلى{" "}
              <strong>{statusLabel(drop.toStatus, "ar")}</strong>؟
            </p>
            {!hasPermission ? (
              <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 p-2 text-[color:var(--color-warning)]">
                ده مش من صلاحياتك — كلم مديرك.
              </p>
            ) : null}
            {block ? (
              <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 p-2 text-[color:var(--color-warning)]">
                {block}
              </p>
            ) : null}
            {noteRequired || action?.requiresTicket ? (
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                  السبب / ملاحظة {noteRequired ? "(مطلوب)" : "(اختياري)"}
                </label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="..."
                />
              </div>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDrop(null)}
                disabled={submitting}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={confirmTransition}
                disabled={
                  submitting ||
                  !!block ||
                  !hasPermission ||
                  (noteRequired && !note.trim())
                }
              >
                {submitting ? "جاري التنفيذ..." : "تأكيد"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

export default OrdersKanbanBoard;
