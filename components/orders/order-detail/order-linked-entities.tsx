"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, PackagePlus, Pencil, TicketIcon, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import {
  TicketStatusBadge,
  TicketTypeBadge,
} from "@/lib/ui/order-badges";
import { can, type PermissionSubject } from "@/lib/auth/rbac";
import type {
  Order,
  Shipment,
  Ticket,
  TicketType,
  User,
} from "@/lib/types/models";

type OrderLinkedEntitiesProps = {
  order: Order;
  shipments: Shipment[];
  users: User[];
  headers: HeadersInit;
  subject: PermissionSubject;
  canViewFinance: boolean;
  onReload: () => Promise<void>;
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
};

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

function parseMoneyInput(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function providerLabel(provider: string) {
  if (provider === "jnt_egypt") return "J&T Egypt";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function canEditShipment(subject: PermissionSubject, shipment: Shipment) {
  return (
    can(subject, "shipment:create") &&
    shipment.status !== "cancelled" &&
    shipment.status !== "shipped" &&
    shipment.status !== "delivered"
  );
}

export function OrderLinkedEntities({
  order,
  shipments,
  users,
  headers,
  subject,
  canViewFinance,
  onReload,
  onMessage,
  onError,
}: OrderLinkedEntitiesProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [editCodAmount, setEditCodAmount] = useState("");
  const [editAllowOpening, setEditAllowOpening] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [savingShipmentEdit, setSavingShipmentEdit] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketType, setTicketType] = useState<TicketType>("complaint");
  const [ticketNotes, setTicketNotes] = useState("");
  const [creatingTicket, setCreatingTicket] = useState(false);

  const userName = useCallback(
    (id?: string | null) => {
      if (!id) return "—";
      return users.find((user) => user.id === id)?.name ?? id;
    },
    [users],
  );

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const response = await fetch(
        `/api/tickets?order_id=${encodeURIComponent(order.id)}`,
        { headers },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? response.statusText);
      setTickets(json.data as Ticket[]);
    } catch (error) {
      onError(error instanceof Error ? error.message : "فشل تحميل التذاكر");
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  }, [headers, onError, order.id]);

  useEffect(() => {
    if (!can(subject, "ticket:read")) {
      setTickets([]);
      setLoadingTickets(false);
      return;
    }
    void loadTickets();
  }, [loadTickets, subject]);

  async function postJson(url: string, body: object) {
    onMessage(null);
    onError(null);
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? response.statusText);
    return json.data;
  }

  function openShipmentEdit(shipment: Shipment) {
    setEditingShipment(shipment);
    setEditCodAmount(String(shipment.cod_amount ?? order.payment.cod_amount ?? 0));
    setEditAllowOpening(Boolean(shipment.allow_opening));
    setEditNotes("");
    onError(null);
    onMessage(null);
  }

  async function onSaveShipmentEdit() {
    if (!editingShipment) return;
    const codAmount = parseMoneyInput(editCodAmount);
    if (codAmount === null || codAmount < 0) {
      onError("مبلغ التحصيل غير صحيح.");
      return;
    }
    setSavingShipmentEdit(true);
    try {
      await postJson(`/api/shipments/${encodeURIComponent(editingShipment.id)}/edit`, {
        codAmount,
        allowOpening: editAllowOpening,
        notes: editNotes.trim() || undefined,
      });
      onMessage("تم تعديل البوليصة.");
      setEditingShipment(null);
      await onReload();
    } catch (error) {
      onError(error instanceof Error ? error.message : "فشل تعديل البوليصة");
    } finally {
      setSavingShipmentEdit(false);
    }
  }

  async function onCreateTicket() {
    setCreatingTicket(true);
    try {
      await postJson("/api/tickets", {
        order_id: order.id,
        type: ticketType,
        notes: ticketNotes.trim() || undefined,
      });
      onMessage("تم فتح التذكرة وربطها بالطلب.");
      setTicketModalOpen(false);
      setTicketNotes("");
      await loadTickets();
    } catch (error) {
      onError(error instanceof Error ? error.message : "فشل فتح التذكرة");
    } finally {
      setCreatingTicket(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>الكيانات المرتبطة بالطلب</CardTitle>
            <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
              التذاكر والبوليصات المرتبطة بنفس الطلب في مكان واحد.
            </p>
          </div>
          {can(subject, "ticket:create") ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setTicketModalOpen(true)}
            >
              <PackagePlus className="size-4" aria-hidden />
              فتح تذكرة جديدة
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
                <TicketIcon className="size-4" aria-hidden />
                التذاكر
              </h3>
              <Badge tone="default">{tickets.length} تذكرة</Badge>
            </div>
            {!can(subject, "ticket:read") ? (
              <p className="rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-4 text-center text-sm text-[color:var(--color-text-muted)]">
                لا توجد صلاحية لعرض التذاكر.
              </p>
            ) : loadingTickets ? (
              <p className="rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-4 text-center text-sm text-[color:var(--color-text-muted)]">
                تحميل التذاكر...
              </p>
            ) : tickets.length === 0 ? (
              <p className="rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-4 text-center text-sm text-[color:var(--color-text-muted)]">
                لا توجد تذاكر مرتبطة بهذا الطلب.
              </p>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <TicketTypeBadge type={ticket.type} />
                          <TicketStatusBadge status={ticket.status} />
                        </div>
                        <p className="text-xs text-[color:var(--color-text-muted)]">
                          {formatWhen(ticket.createdAt)} · {userName(ticket.assigned_to)}
                        </p>
                      </div>
                      <Link href={`/tickets/${ticket.id}`}>
                        <Button type="button" variant="secondary" size="sm">
                          <FileText className="size-3.5" aria-hidden />
                          فتح
                        </Button>
                      </Link>
                    </div>
                    {ticket.notes ? (
                      <p className="mt-3 text-[13px] leading-relaxed text-[color:var(--color-text-secondary)]">
                        {ticket.notes}
                      </p>
                    ) : null}
                    {ticket.shipmentIds.length > 0 ? (
                      <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
                        بوليصات مرتبطة: {ticket.shipmentIds.join(", ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
                <Truck className="size-4" aria-hidden />
                البوليصات
              </h3>
              <Badge tone="default">{shipments.length} بوليصة</Badge>
            </div>
            {shipments.length === 0 ? (
              <p className="rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-4 text-center text-sm text-[color:var(--color-text-muted)]">
                لا توجد بوليصات بعد.
              </p>
            ) : (
              <div className="space-y-3">
                {shipments.map((shipment) => (
                  <div
                    key={shipment.id}
                    className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="info">{providerLabel(shipment.provider)}</Badge>
                          <Badge tone="default">{shipment.type}</Badge>
                          <Badge tone={shipment.status === "delivered" ? "success" : "default"}>
                            {shipment.status}
                          </Badge>
                        </div>
                        <p className="font-mono text-xs text-[color:var(--color-text-primary)]">
                          AWB: {shipment.awb || "—"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={!canEditShipment(subject, shipment)}
                        onClick={() => openShipmentEdit(shipment)}
                        title="تعديل مبلغ التحصيل والمعاينة"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        تعديل
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-[color:var(--color-text-secondary)] sm:grid-cols-2">
                      <span>حالة شركة الشحن: {shipment.carrierTrackingStatus ?? "—"}</span>
                      <span>
                        التحصيل:{" "}
                        {canViewFinance
                          ? formatMoney(shipment.cod_amount ?? order.payment.cod_amount)
                          : "مخفي"}
                      </span>
                      <span>المعاينة: {shipment.allow_opening ? "مسموح" : "غير مسموح"}</span>
                      <span>أنشأها: {shipment.createdByUserName ?? "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </CardContent>
      </Card>

      <Modal
        open={ticketModalOpen}
        title="فتح تذكرة مرتبطة بالطلب"
        onClose={() => {
          if (!creatingTicket) setTicketModalOpen(false);
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={creatingTicket}
              onClick={() => setTicketModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button type="button" loading={creatingTicket} onClick={onCreateTicket}>
              فتح التذكرة
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="نوع التذكرة"
            value={ticketType}
            onChange={(event) => setTicketType(event.target.value as TicketType)}
          >
            <option value="complaint">Complaint</option>
            <option value="return">Return</option>
            <option value="exchange">Exchange</option>
          </Select>
          <Textarea
            label="ملاحظات"
            value={ticketNotes}
            onChange={(event) => setTicketNotes(event.target.value)}
            placeholder="سبب التذكرة أو ملاحظات خدمة العملاء"
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(editingShipment)}
        title="تعديل البوليصة"
        onClose={() => {
          if (!savingShipmentEdit) setEditingShipment(null);
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditingShipment(null)}
              disabled={savingShipmentEdit}
            >
              إلغاء
            </Button>
            <Button type="button" loading={savingShipmentEdit} onClick={onSaveShipmentEdit}>
              حفظ التعديل
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <p className="rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-3 text-[color:var(--color-text-secondary)]">
            يتم إرسال التعديل إلى بوسطة لو البوليصة فعلية. لو حالة الشحنة لا تسمح،
            سيظهر تنبيه لإلغاء البوليصة وإنشاء واحدة جديدة.
          </p>
          <Input
            label="مبلغ التحصيل COD"
            type="number"
            min="0"
            step="0.01"
            value={editCodAmount}
            onChange={(event) => setEditCodAmount(event.target.value)}
          />
          <div className="flex items-center justify-between gap-3 rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] p-3">
            <div>
              <p
                id="shipment-allow-opening-label"
                className="font-medium text-[color:var(--color-text-primary)]"
              >
                السماح بالمعاينة / فتح الشحنة
              </p>
              <p className="text-xs text-[color:var(--color-text-muted)]">
                فعّلها لو العميل مسموح له يفتح أو يعاين الشحنة قبل الاستلام.
              </p>
            </div>
            <Switch
              checked={editAllowOpening}
              onCheckedChange={setEditAllowOpening}
              aria-labelledby="shipment-allow-opening-label"
            />
          </div>
          <Textarea
            label="ملاحظة لبوسطة"
            value={editNotes}
            onChange={(event) => setEditNotes(event.target.value)}
            placeholder="مثال: تعديل مبلغ التحصيل أو السماح بالمعاينة"
          />
        </div>
      </Modal>
    </>
  );
}
