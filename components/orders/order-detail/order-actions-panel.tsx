"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  FileText,
  MessageCircle,
  PackageCheck,
  Trash2,
  Truck,
  UserPlus,
  XCircle,
} from "lucide-react";
import { ActionModal, type ActionModalResult } from "@/components/orders/order-detail/action-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { OrderStatusBadge, PaymentBadge } from "@/lib/ui/order-badges";
import { availableActions, type OrderActionDef } from "@/lib/logic/order-actions";
import { can, type PermissionSubject } from "@/lib/auth/rbac";
import { buildWhatsAppUrl } from "@/lib/ui/whatsapp";
import { formatConfirmationWhatsAppMessage } from "@/lib/logic/confirmation-whatsapp";
import type {
  Order,
  Shipment,
  ShipmentLabelFormat,
  ShipmentType,
  ShippingProvider,
  User,
} from "@/lib/types/models";

const SHIPMENT_PROVIDERS: { value: Exclude<ShippingProvider, "mock">; label: string }[] = [
  { value: "bosta", label: "Bosta" },
  { value: "jnt_egypt", label: "J&T Egypt" },
  { value: "fedex", label: "FedEx" },
];

type PendingModal =
  | { type: "note"; action: OrderActionDef }
  | { type: "invoice"; action: OrderActionDef }
  | { type: "assign" }
  | { type: "delete" }
  | { type: "paid-amount" }
  | null;

type OrderActionsPanelProps = {
  order: Order;
  shipments: Shipment[];
  users: User[];
  headers: HeadersInit;
  subject: PermissionSubject;
  whatsappTemplate: string;
  orderLinkTemplate: string;
  onReload: () => Promise<void>;
  onDeleted: () => void;
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
};

function latestDeliveryAwb(shipments: Shipment[]) {
  return shipments.find((shipment) => shipment.type === "delivery")?.awb?.trim() ?? "—";
}

function iconForAction(action: OrderActionDef) {
  if (action.id === "confirm") {
    return <CheckCircle2 className="size-4 shrink-0" aria-hidden />;
  }
  if (action.id === "issue_invoice" || action.id === "request_invoice") {
    return <FileText className="size-4 shrink-0" aria-hidden />;
  }
  if (
    action.id === "create_awb" ||
    action.id === "dispatch" ||
    action.id === "retry_shipping"
  ) {
    return <Truck className="size-4 shrink-0" aria-hidden />;
  }
  if (action.id === "mark_packed" || action.id === "mark_delivered") {
    return <PackageCheck className="size-4 shrink-0" aria-hidden />;
  }
  return null;
}

export function OrderActionsPanel({
  order,
  shipments,
  users,
  headers,
  subject,
  whatsappTemplate,
  orderLinkTemplate,
  onReload,
  onDeleted,
  onMessage,
  onError,
}: OrderActionsPanelProps) {
  const [pendingModal, setPendingModal] = useState<PendingModal>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [shipmentCreateOpen, setShipmentCreateOpen] = useState(false);
  const [shipmentProvider, setShipmentProvider] =
    useState<Exclude<ShippingProvider, "mock">>("bosta");
  const [shipmentTypeDraft, setShipmentTypeDraft] = useState<ShipmentType>("delivery");
  const [shipmentServiceDraft, setShipmentServiceDraft] = useState("");
  const [shipmentLabelFormat, setShipmentLabelFormat] =
    useState<ShipmentLabelFormat>("pdf");
  const [creatingShipment, setCreatingShipment] = useState(false);

  const actions = useMemo(() => availableActions(order, subject), [order, subject]);
  const dangerActions = actions.filter(
    (action) => action.variant === "danger" || action.id === "cancel",
  );
  const workflowActions = actions.filter(
    (action) => !dangerActions.some((danger) => danger.id === action.id),
  );
  const showShipment =
    can(subject, "shipment:create") &&
    order.status !== "cancelled" &&
    !actions.some((action) => action.id === "create_awb");
  const showAssign = can(subject, "order:assign");
  const showWhatsApp = can(subject, "order:confirm") && Boolean(order.customer.phone);
  const showDelete = can(subject, "order:delete");

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

  async function runConfirm(paidAmount?: number) {
    setActiveActionId("confirm");
    try {
      await postJson("/api/orders/confirm", {
        orderId: order.id,
        ...(typeof paidAmount === "number" ? { paidAmount } : {}),
      });
      onMessage("تم تأكيد الطلب.");
      await onReload();
    } catch (error) {
      onError(error instanceof Error ? error.message : "فشل تأكيد الطلب");
    } finally {
      setActiveActionId(null);
    }
  }

  async function runTransition(action: OrderActionDef, note?: string) {
    setActiveActionId(action.id);
    try {
      await postJson("/api/orders/transition", {
        orderId: order.id,
        actionId: action.id,
        note,
      });
      onMessage(`${action.label_ar} ✓`);
      await onReload();
    } catch (error) {
      onError(error instanceof Error ? error.message : "فشل التنفيذ");
    } finally {
      setActiveActionId(null);
    }
  }

  function startAction(action: OrderActionDef) {
    onMessage(null);
    onError(null);
    if (action.requiresInvoiceNumberPrompt) {
      setPendingModal({ type: "invoice", action });
      return;
    }
    if (action.id === "confirm") {
      if (order.payment.payment_status === "partial") {
        setPendingModal({ type: "paid-amount" });
      } else {
        void runConfirm();
      }
      return;
    }
    if (action.requiresNote) {
      setPendingModal({ type: "note", action });
      return;
    }
    void runTransition(action);
  }

  async function submitActionModal(result: ActionModalResult) {
    setSubmitting(true);
    try {
      if (result.mode === "note" && pendingModal?.type === "note") {
        await runTransition(pendingModal.action, result.note);
      } else if (result.mode === "invoice" && pendingModal?.type === "invoice") {
        await postJson("/api/orders/invoice", {
          orderId: order.id,
          invoiceNumber: result.invoiceNumber,
        });
        onMessage("تمت الفوترة.");
        await onReload();
      } else if (result.mode === "assign") {
        await postJson("/api/orders/assign", {
          orderId: order.id,
          assigneeUserId: result.assigneeUserId,
        });
        onMessage("تم تحديث التعيين.");
        await onReload();
      } else if (result.mode === "confirm-delete") {
        await deleteOrder();
      } else if (result.mode === "paid-amount") {
        await runConfirm(result.paidAmount);
      }
      setPendingModal(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "فشل التنفيذ");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteOrder() {
    setDeleting(true);
    onMessage(null);
    onError(null);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: "DELETE",
        headers,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? response.statusText);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  async function onWhatsApp() {
    if (!order.customer.phone) return;
    const deliveryAwb = latestDeliveryAwb(shipments);
    const orderLink = orderLinkTemplate
      ? formatConfirmationWhatsAppMessage(orderLinkTemplate, {
          order,
          shipments,
          awb: deliveryAwb,
          orderLink: "",
        }).trim()
      : "";
    const body = formatConfirmationWhatsAppMessage(whatsappTemplate, {
      order,
      shipments,
      orderLink,
      awb: deliveryAwb,
    });
    const url = buildWhatsAppUrl(order.customer.phone, body);
    if (!url) {
      onError("رقم هاتف غير صالح لـ WhatsApp");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    try {
      await postJson("/api/orders/whatsapp", {
        orderId: order.id,
        phone: order.customer.phone,
      });
      onMessage("تم تسجيل إرسال واتساب.");
      await onReload();
    } catch (error) {
      onError(error instanceof Error ? error.message : "فشل التسجيل");
    }
  }

  async function onCreateShipment() {
    setCreatingShipment(true);
    onError(null);
    onMessage(null);
    try {
      await postJson("/api/shipments/create", {
        orderId: order.id,
        type: shipmentTypeDraft,
        provider: shipmentProvider,
        serviceCode: shipmentServiceDraft.trim() || undefined,
        labelFormat: shipmentLabelFormat,
      });
      onMessage("تم إنشاء البوليصة.");
      setShipmentCreateOpen(false);
      await onReload();
    } catch (error) {
      onError(error instanceof Error ? error.message : "فشل إنشاء البوليصة");
    } finally {
      setCreatingShipment(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-base font-semibold md:text-[18px]">
              إجراءات الطلب
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={order.status} />
              <PaymentBadge status={order.payment.payment_status} />
            </div>
            <p className="max-w-xl text-[13px] text-[color:var(--color-text-secondary)] md:text-sm">
              نفّذ خطوات سير العمل المناسبة؛ يُسجّل كل إجراء في سجل النشاط بالأسفل.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
              سير العمل
            </p>
            <div className="flex flex-wrap gap-2">
              {workflowActions.length === 0 && !showShipment ? (
                <p className="text-sm text-[color:var(--color-text-muted)]">
                  لا توجد إجراءات سير عمل متاحة لهذه الحالة أو صلاحياتك الحالية.
                </p>
              ) : null}
              {workflowActions.map((action) => (
                <Button
                  key={action.id}
                  type="button"
                  size="sm"
                  variant={action.variant === "primary" ? "primary" : "secondary"}
                  loading={activeActionId === action.id}
                  onClick={() => startAction(action)}
                  title={action.label_en}
                >
                  {iconForAction(action)}
                  {action.label_ar}
                </Button>
              ))}
              {showShipment ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShipmentCreateOpen(true)}
                >
                  <Truck className="size-4 shrink-0" aria-hidden />
                  إنشاء بوليصة
                </Button>
              ) : null}
            </div>
          </div>

          {(showWhatsApp || showAssign) && (
            <div className="space-y-2 border-t border-[color:var(--color-divider)] pt-4">
              <p className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                تواصل وتعيين
              </p>
              <div className="flex flex-wrap gap-2">
                {showWhatsApp ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onWhatsApp}
                  >
                    <MessageCircle className="size-4 shrink-0" aria-hidden />
                    واتساب وتسجيل الإرسال
                  </Button>
                ) : null}
                {showAssign ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setPendingModal({ type: "assign" })}
                  >
                    <UserPlus className="size-4 shrink-0" aria-hidden />
                    تعيين الطلب
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          {(dangerActions.length > 0 || showDelete) && (
            <div className="space-y-2 border-t border-[color:var(--color-divider)] pt-4">
              <p className="text-[12px] font-medium text-[color:var(--color-error)]">
                إجراءات حساسة
              </p>
              <div className="flex flex-wrap gap-2">
                {dangerActions.map((action) => (
                  <Button
                    key={action.id}
                    type="button"
                    variant="danger"
                    size="sm"
                    loading={activeActionId === action.id}
                    onClick={() => startAction(action)}
                  >
                    <XCircle className="size-4 shrink-0" aria-hidden />
                    {action.label_ar}
                  </Button>
                ))}
                {showDelete ? (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    loading={deleting}
                    onClick={() => setPendingModal({ type: "delete" })}
                  >
                    <Trash2 className="size-4 shrink-0" aria-hidden />
                    حذف نهائي
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ActionModal
        open={Boolean(pendingModal)}
        mode={
          pendingModal?.type === "note"
            ? "note"
            : pendingModal?.type === "invoice"
              ? "invoice"
              : pendingModal?.type === "assign"
                ? "assign"
                : pendingModal?.type === "paid-amount"
                  ? "paid-amount"
                  : "confirm-delete"
        }
        title={
          pendingModal?.type === "note"
            ? pendingModal.action.label_ar
            : pendingModal?.type === "invoice"
              ? "إصدار الفاتورة"
              : pendingModal?.type === "assign"
                ? "تعيين الطلب"
                : pendingModal?.type === "paid-amount"
                  ? "تأكيد قيمة الدفع المسبق"
                  : "حذف الطلب نهائياً"
        }
        description={
          pendingModal?.type === "delete"
            ? "سيتم حذف الطلب نهائياً مع الشحنات والتذاكر المرتبطة به، مع حفظ سجل بالحذف."
            : pendingModal?.type === "paid-amount"
              ? "هذا الطلب عليه دفع جزئي. أدخل قيمة الدفع المسبق قبل تأكيد الطلب."
              : undefined
        }
        confirmLabel={
          pendingModal?.type === "delete"
            ? "حذف نهائي"
            : pendingModal?.type === "invoice"
              ? "إصدار الفاتورة"
              : pendingModal?.type === "assign"
                ? "حفظ التعيين"
                : pendingModal?.type === "paid-amount"
                  ? "تأكيد الطلب"
                  : "تنفيذ الإجراء"
        }
        destructive={pendingModal?.type === "delete" || pendingModal?.type === "note" && pendingModal.action.variant === "danger"}
        loading={submitting || deleting}
        users={users}
        currentAssigneeId={order.assigned_to ?? null}
        defaultValue={
          pendingModal?.type === "paid-amount" && order.payment.paid_amount > 0
            ? String(order.payment.paid_amount)
            : ""
        }
        totalAmount={order.payment.total_amount}
        onClose={() => setPendingModal(null)}
        onSubmit={submitActionModal}
      />

      <Modal
        open={shipmentCreateOpen}
        title="إنشاء بوليصة شحن"
        onClose={() => {
          if (!creatingShipment) setShipmentCreateOpen(false);
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={creatingShipment}
              onClick={() => setShipmentCreateOpen(false)}
            >
              إلغاء
            </Button>
            <Button type="button" loading={creatingShipment} onClick={onCreateShipment}>
              إنشاء البوليصة
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="شركة الشحن"
            value={shipmentProvider}
            onChange={(event) =>
              setShipmentProvider(event.target.value as Exclude<ShippingProvider, "mock">)
            }
          >
            {SHIPMENT_PROVIDERS.map((provider) => (
              <option key={provider.value} value={provider.value}>
                {provider.label}
              </option>
            ))}
          </Select>
          <Select
            label="نوع البوليصة"
            value={shipmentTypeDraft}
            onChange={(event) => setShipmentTypeDraft(event.target.value as ShipmentType)}
          >
            <option value="delivery">Delivery</option>
            <option value="return">Return</option>
            <option value="exchange">Exchange</option>
          </Select>
          <Select
            label="نوع الطباعة"
            value={shipmentLabelFormat}
            onChange={(event) =>
              setShipmentLabelFormat(event.target.value as ShipmentLabelFormat)
            }
          >
            <option value="pdf">PDF</option>
            <option value="zpl">Thermal / ZPL</option>
          </Select>
          <Input
            label="كود الخدمة (اختياري)"
            placeholder={shipmentProvider === "fedex" ? "INTERNATIONAL_PRIORITY" : "EZ"}
            value={shipmentServiceDraft}
            onChange={(event) => setShipmentServiceDraft(event.target.value)}
          />
        </div>
      </Modal>
    </>
  );
}
