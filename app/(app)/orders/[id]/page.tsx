"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  MessageCircle,
  PackageCheck,
  Trash2,
  Truck,
  UserPlus,
  UserRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveCard } from "@/components/responsive/ResponsiveCard";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { TableWrap, Th, Tr, Td } from "@/components/ui/table";
import { OrderDetailSkeleton } from "@/components/ui/skeleton";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { can } from "@/lib/auth/rbac";
import type {
  ActivityLog,
  Order,
  Shipment,
  ShipmentType,
  User,
} from "@/lib/types/models";
import { OrderStatusBadge, PaymentBadge } from "@/lib/ui/order-badges";
import { buildWhatsAppUrl } from "@/lib/ui/whatsapp";
import { formatConfirmationWhatsAppMessage } from "@/lib/logic/confirmation-whatsapp";
import { defaultTenantAutomation } from "@/lib/types/models";
import { cn } from "@/lib/ui/cn";

type Bundle = { order: Order; shipments: Shipment[] };

function displayOrderId(order: Order) {
  return order.wooCommerceOrderId?.trim() || order.id.slice(0, 8).toUpperCase();
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

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function latestAwb(shipments: Shipment[]) {
  return shipments.find((s) => s.type === "delivery")?.awb?.trim() ?? "—";
}

function DetailItem({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
        {label}
      </div>
      <div className="text-sm text-[color:var(--color-text-primary)]">
        {children}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
  children,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card className="shadow-[var(--shadow-neo-raised-sm)]">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
              {label}
            </p>
            <div className="text-lg font-semibold text-[color:var(--color-text-primary)]">
              {value}
            </div>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-muted-bg)] text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-inset)]">
            {icon}
          </span>
        </div>
        {detail ? (
          <p className="text-xs text-[color:var(--color-text-muted)]">{detail}</p>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const permissions = useSessionStore((s) => s.permissions);
  const authReady = useSessionStore((s) => s.authReady);

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [statusNeighbors, setStatusNeighbors] = useState<{
    prevId: string | null;
    nextId: string | null;
  }>({ prevId: null, nextId: null });
  const [whatsappTemplate, setWhatsappTemplate] = useState(
    defaultTenantAutomation.whatsappMessageTemplate!,
  );
  const [orderLinkTemplate, setOrderLinkTemplate] = useState("");

  const headers = useMemo(
    () => buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
    [apiSecret, idToken, tenantId, userId, role],
  );

  const userName = useCallback(
    (id: string) => users.find((u) => u.id === id)?.name ?? id,
    [users],
  );

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    setStatusNeighbors({ prevId: null, nextId: null });
    try {
      const [bRes, aRes, uRes, wRes, nRes] = await Promise.all([
        fetch(`/api/orders/${encodeURIComponent(orderId)}`, { headers }),
        fetch(
          `/api/activity?entityType=order&entityId=${encodeURIComponent(orderId)}&limit=80`,
          { headers },
        ),
        fetch("/api/users", { headers }),
        fetch("/api/settings/confirmation-whatsapp", { headers }),
        fetch(`/api/orders/${encodeURIComponent(orderId)}/neighbors`, {
          headers,
        }),
      ]);
      const bJson = await bRes.json();
      const aJson = await aRes.json();
      const uJson = await uRes.json();
      if (!bRes.ok) throw new Error(bJson.error ?? bRes.statusText);
      if (!aRes.ok) throw new Error(aJson.error ?? aRes.statusText);
      if (!uRes.ok) throw new Error(uJson.error ?? uRes.statusText);
      setBundle(bJson.data as Bundle);
      if (nRes.ok) {
        const nJson = (await nRes.json()) as {
          data?: { prevId: string | null; nextId: string | null };
        };
        setStatusNeighbors(
          nJson.data ?? { prevId: null, nextId: null },
        );
      } else {
        setStatusNeighbors({ prevId: null, nextId: null });
      }
      setActivities(aJson.data as ActivityLog[]);
      setUsers(uJson.data as User[]);
      if (wRes.ok) {
        const wJson = (await wRes.json()) as {
          data: {
            whatsappMessageTemplate: string;
            orderLinkTemplate?: string;
          };
        };
        if (wJson.data?.whatsappMessageTemplate) {
          setWhatsappTemplate(wJson.data.whatsappMessageTemplate);
        } else {
          setWhatsappTemplate(
            defaultTenantAutomation.whatsappMessageTemplate!,
          );
        }
        setOrderLinkTemplate(wJson.data?.orderLinkTemplate?.trim() ?? "");
      } else {
        setWhatsappTemplate(
          defaultTenantAutomation.whatsappMessageTemplate!,
        );
        setOrderLinkTemplate("");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطأ");
      setBundle(null);
      setStatusNeighbors({ prevId: null, nextId: null });
    } finally {
      setLoading(false);
    }
  }, [orderId, headers]);

  useEffect(() => {
    if (!authReady) return;
    void load();
  }, [authReady, load]);

  const { prevId, nextId } = statusNeighbors;

  function goOrder(targetId: string) {
    router.push(`/orders/${targetId}`);
  }

  async function postJson(url: string, body: object) {
    setMsg(null);
    setErr(null);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? res.statusText);
    return json.data;
  }

  async function onConfirm() {
    try {
      const body: { orderId: string; paidAmount?: number } = { orderId };
      const order = bundle?.order;
      if (order?.payment.payment_status === "partial") {
        const raw = window.prompt(
          `قيمة الدفع المسبق للطلب؟ الإجمالي ${formatMoney(order.payment.total_amount)}`,
          order.payment.paid_amount > 0 ? String(order.payment.paid_amount) : "",
        );
        if (raw === null) return;
        const paidAmount = parseMoneyInput(raw);
        if (paidAmount === null) {
          setErr("قيمة الدفع المسبق غير صحيحة.");
          return;
        }
        if (paidAmount < 0) {
          setErr("قيمة الدفع المسبق لا يمكن أن تكون بالسالب.");
          return;
        }
        if (paidAmount > order.payment.total_amount) {
          setErr("قيمة الدفع المسبق لا يمكن أن تتجاوز إجمالي الطلب.");
          return;
        }
        body.paidAmount = paidAmount;
      }
      await postJson("/api/orders/confirm", body);
      setMsg("تم تأكيد الطلب.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "فشل");
    }
  }

  async function onCancel() {
    const reason = window.prompt("سبب إلغاء الطلب؟");
    if (!reason?.trim()) return;
    if (!window.confirm("تأكيد إلغاء الطلب؟")) return;
    try {
      await postJson("/api/orders/cancel", { orderId, reason: reason.trim() });
      setMsg("تم إلغاء الطلب.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "فشل");
    }
  }

  async function onCreateShipment() {
    const raw = window.prompt(
      "نوع البوليصة؟ اكتب delivery أو return أو exchange",
      "delivery",
    );
    if (!raw) return;
    const type = raw.trim().toLowerCase() as ShipmentType;
    if (!["delivery", "return", "exchange"].includes(type)) {
      setErr("نوع البوليصة غير صحيح.");
      return;
    }
    try {
      await postJson("/api/shipments/create", { orderId, type });
      setMsg("تم إنشاء البوليصة.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "فشل إنشاء البوليصة");
    }
  }

  async function onInvoice() {
    const num = window.prompt("رقم الفاتورة؟");
    if (!num?.trim()) return;
    try {
      await postJson("/api/orders/invoice", {
        orderId,
        invoiceNumber: num.trim(),
      });
      setMsg("تمت الفوترة.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "فشل");
    }
  }

  async function onAssign() {
    const assignee = window.prompt("معرّف المستخدم للتعيين (فارغ لإلغاء التعيين)؟");
    if (assignee === null) return;
    try {
      await postJson("/api/orders/assign", {
        orderId,
        assigneeUserId: assignee.trim() === "" ? null : assignee.trim(),
      });
      setMsg("تم تحديث التعيين.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "فشل");
    }
  }

  async function onDelete() {
    if (
      !window.confirm(
        "تأكيد حذف الطلب نهائياً؟ سيتم حذف الشحنات والتذاكر المرتبطة به، مع حفظ سجل بالحذف.",
      )
    ) {
      return;
    }
    setDeleting(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const navigateTo =
        statusNeighbors.nextId ?? statusNeighbors.prevId ?? null;
      if (navigateTo) {
        router.push(`/orders/${navigateTo}`);
      } else {
        router.push("/orders");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "فشل حذف الطلب");
    } finally {
      setDeleting(false);
    }
  }

  async function onWhatsApp() {
    const o = bundle?.order;
    const shipments = bundle?.shipments;
    if (!o?.customer.phone) return;
    const deliveryAwb =
      shipments?.find((s) => s.type === "delivery")?.awb?.trim() ?? "—";
    const orderLink = orderLinkTemplate
      ? formatConfirmationWhatsAppMessage(orderLinkTemplate, {
          order: o,
          shipments: shipments ?? [],
          awb: deliveryAwb,
          orderLink: "",
        }).trim()
      : "";
    const body = formatConfirmationWhatsAppMessage(whatsappTemplate, {
      order: o,
      shipments: shipments ?? [],
      orderLink,
      awb: deliveryAwb,
    });
    const url = buildWhatsAppUrl(o.customer.phone, body);
    if (!url) {
      setErr("رقم هاتف غير صالح لـ WhatsApp");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    try {
      await postJson("/api/orders/whatsapp", {
        orderId,
        phone: o.customer.phone,
      });
      setMsg("تم تسجيل إرسال واتساب.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "فشل التسجيل");
    }
  }

  const o = bundle?.order;
  const displayId = o ? displayOrderId(o) : orderId.slice(0, 8).toUpperCase();
  const deliveryAwb = bundle ? latestAwb(bundle.shipments) : "—";
  const whatsappUser =
    o?.whatsappSentByUserName?.trim() || o?.whatsappSentByUserId?.trim();
  const permissionSubject = { role, permissions };
  const canViewFinance = can(permissionSubject, "finance:view");

  const showConfirm =
    !!o &&
    can(permissionSubject, "order:confirm") &&
    o.status === "pending_confirmation";
  const showCancel =
    !!o &&
    can(permissionSubject, "order:cancel") &&
    o.status !== "cancelled";
  const showShipment =
    !!o &&
    can(permissionSubject, "shipment:create") &&
    o.status !== "cancelled";
  const showInvoice =
    !!o &&
    can(permissionSubject, "order:invoice") &&
    (o.status === "confirmed" || o.status === "invoice_required");
  const showAssign = !!o && can(permissionSubject, "order:assign");
  const showWhatsApp =
    !!o &&
    can(permissionSubject, "order:confirm") &&
    !!o.customer.phone;
  const showDelete = !!o && can(permissionSubject, "order:delete");

  return (
    <div className="space-y-6">
      <PageHeader
        title={loading ? "تفاصيل الطلب" : `طلب #${displayId}`}
        description={
          loading
            ? "تحميل بيانات الطلب، العميل، الدفع، الشحن وسجل الإجراءات."
            : `آخر تحديث: ${o ? formatWhen(o.updatedAt) : "—"}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/orders">
              <Button type="button" variant="secondary" size="sm">
                <ArrowLeft className="size-4" aria-hidden />
                القائمة
              </Button>
            </Link>
            {prevId ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => goOrder(prevId)}
              >
                <ChevronRight className="size-4" aria-hidden />
                السابق
              </Button>
            ) : null}
            {nextId ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => goOrder(nextId)}
              >
                التالي
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        }
      />

      {!loading && err ? (
        <p className="rounded-xl border-0 bg-[color:var(--color-error)]/12 p-3 text-sm text-[color:var(--color-error)] shadow-[var(--shadow-neo-raised-sm)]">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-xl border-0 bg-[color:var(--color-callout-success-bg)] p-3 text-sm text-[color:var(--color-callout-success-text)] shadow-[var(--shadow-neo-raised-sm)]">
          {msg}
        </p>
      ) : null}

      {loading ? (
        <OrderDetailSkeleton />
      ) : o ? (
        <>
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <CardTitle className="text-base font-semibold md:text-[18px]">
                  إجراءات الطلب
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <OrderStatusBadge status={o.status} />
                  <PaymentBadge status={o.payment.payment_status} />
                </div>
                <p className="max-w-xl text-[13px] text-[color:var(--color-text-secondary)] md:text-sm">
                  نفّذ خطوات سير العمل المناسبة؛ يُسجّل كل إجراء في سجل النشاط بالأسفل.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
                  سير العمل
                </p>
                <div className="flex flex-wrap gap-2">
                  {showConfirm ? (
                    <Button type="button" size="sm" onClick={onConfirm}>
                      <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                      تأكيد الطلب
                    </Button>
                  ) : null}
                  {showInvoice ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={onInvoice}
                    >
                      <FileText className="size-4 shrink-0" aria-hidden />
                      فوترة / جاهز للمخزن
                    </Button>
                  ) : null}
                  {showShipment ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={onCreateShipment}
                    >
                      <Truck className="size-4 shrink-0" aria-hidden />
                      إنشاء بوليصة
                    </Button>
                  ) : null}
                  {!showConfirm && !showInvoice && !showShipment ? (
                    <p className="text-sm text-[color:var(--color-text-muted)]">
                      لا توجد إجراءات سير عمل متاحة لهذه الحالة أو صلاحياتك الحالية.
                    </p>
                  ) : null}
                </div>
              </div>

              {(showWhatsApp || showAssign) && (
                <div className="space-y-2 border-t border-[color:var(--color-divider)] pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
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
                        onClick={onAssign}
                      >
                        <UserPlus className="size-4 shrink-0" aria-hidden />
                        تعيين الطلب
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}

              {(showCancel || showDelete) && (
                <div className="space-y-2 border-t border-[color:var(--color-divider)] pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-error)]">
                    إجراءات حساسة
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {showCancel ? (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={onCancel}
                      >
                        <XCircle className="size-4 shrink-0" aria-hidden />
                        إلغاء الطلب
                      </Button>
                    ) : null}
                    {showDelete ? (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        loading={deleting}
                        onClick={onDelete}
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

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="العميل"
              value={o.customer.name}
              detail={o.customer.phone ?? o.customer.email ?? "لا توجد وسيلة تواصل"}
              icon={<UserRound className="size-5" aria-hidden />}
            />
            <SummaryCard
              label="إجمالي الطلب"
              value={canViewFinance ? formatMoney(o.payment.total_amount) : "مخفي"}
              detail={
                canViewFinance
                  ? `متبقي ${formatMoney(o.payment.remaining_amount)}`
                  : "يتطلب صلاحية عرض المالية"
              }
              icon={<WalletCards className="size-5" aria-hidden />}
            />
            <SummaryCard
              label="الشحنات"
              value={`${bundle.shipments.length} بوليصة`}
              detail={`AWB: ${deliveryAwb}`}
              icon={<Truck className="size-5" aria-hidden />}
            />
            <SummaryCard
              label="الأصناف"
              value={`${o.lineItems?.length ?? 0} صنف`}
              detail={`تم إنشاء الطلب ${formatWhen(o.createdAt)}`}
              icon={<PackageCheck className="size-5" aria-hidden />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>العميل والعنوان</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                <DetailItem label="الاسم">
                  <span className="font-medium">{o.customer.name}</span>
                </DetailItem>
                <DetailItem label="الهاتف">{o.customer.phone ?? "—"}</DetailItem>
                <DetailItem label="البريد">{o.customer.email ?? "—"}</DetailItem>
                <DetailItem label="العنوان" className="sm:col-span-2">
                  {o.customer.address ?? "—"}
                </DetailItem>
                {o.notes ? (
                  <DetailItem label="ملاحظات" className="sm:col-span-2">
                    <span className="block rounded-xl bg-[color:var(--color-bg-subtle)] p-3 shadow-[var(--shadow-neo-inset)]">
                      {o.notes}
                    </span>
                  </DetailItem>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>الدفع والحالة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <OrderStatusBadge status={o.status} />
                  <PaymentBadge status={o.payment.payment_status} />
                </div>
                {canViewFinance ? (
                  <div className="grid grid-cols-2 gap-3">
                    <DetailItem label="الإجمالي">
                      <span className="font-semibold tabular-nums">
                        {formatMoney(o.payment.total_amount)}
                      </span>
                    </DetailItem>
                    <DetailItem label="المدفوع">
                      <span className="tabular-nums">
                        {formatMoney(o.payment.paid_amount)}
                      </span>
                    </DetailItem>
                    <DetailItem label="المتبقي">
                      <span className="tabular-nums">
                        {formatMoney(o.payment.remaining_amount)}
                      </span>
                    </DetailItem>
                    <DetailItem label="التحصيل عند الاستلام">
                      <span className="tabular-nums">
                        {formatMoney(o.payment.cod_amount)}
                      </span>
                    </DetailItem>
                  </div>
                ) : (
                  <p className="rounded-xl bg-[color:var(--color-bg-subtle)] p-3 text-xs text-[color:var(--color-text-muted)] shadow-[var(--shadow-neo-inset)]">
                    تفاصيل المبالغ مخفية حسب صلاحيات المستخدم.
                  </p>
                )}
                {o.invoice ? (
                  <DetailItem label="فاتورة">
                    <span className="font-mono text-xs">
                      {o.invoice.number} — {o.invoice.issuedAt ?? ""}
                    </span>
                  </DetailItem>
                ) : null}
                {o.wooCommerceOrderId ? (
                  <DetailItem label="WooCommerce">
                    {o.wooCommerceOrderAdminUrl ? (
                      <a
                        href={o.wooCommerceOrderAdminUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[color:var(--color-primary)] hover:underline"
                      >
                        #{o.wooCommerceOrderId}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : (
                      <div className="font-mono text-xs">
                        {o.wooCommerceOrderId}
                      </div>
                    )}
                  </DetailItem>
                ) : null}
                {o.whatsappSentAt ? (
                  <DetailItem label="واتساب">
                    <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-[color:var(--color-success)]/12 px-2 py-1 text-xs font-medium text-[color:var(--color-success)]">
                      <MessageCircle className="size-3.5" aria-hidden />
                      <span>تم الإرسال</span>
                      <span>بواسطة {whatsappUser ?? "مستخدم"}</span>
                      <span>· {formatWhen(o.whatsappSentAt)}</span>
                    </div>
                  </DetailItem>
                ) : null}
                {o.assigned_to ? (
                  <DetailItem label="معيّن إلى">
                    <span>
                      {userName(o.assigned_to)} ({o.assigned_to})
                    </span>
                  </DetailItem>
                ) : null}
                {o.cancelReason ? (
                  <DetailItem label="سبب الإلغاء">
                    <span className="block rounded-xl bg-[color:var(--color-error)]/10 p-3 text-[color:var(--color-error)]">
                      {o.cancelReason}
                      {o.cancelledAt ? ` · ${formatWhen(o.cancelledAt)}` : ""}
                    </span>
                  </DetailItem>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>المنتجات والشحن</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {o.shipping ? (
                <div className="grid gap-3 rounded-xl bg-[color:var(--color-bg-subtle)] p-3 shadow-[var(--shadow-neo-inset)] sm:grid-cols-2">
                  <DetailItem label="طريقة الشحن">
                    {o.shipping.method ?? "—"}
                  </DetailItem>
                  <DetailItem label="تكلفة الشحن">
                    <span className="font-semibold tabular-nums">
                      {formatMoney(o.shipping.cost)}
                    </span>
                  </DetailItem>
                </div>
              ) : null}
              {o.lineItems?.length ? (
                <ResponsiveTable
                  desktop={
                    <TableWrap>
                      <thead>
                        <tr>
                          <Th>الصنف</Th>
                          <Th>SKU</Th>
                          <Th>الكمية</Th>
                          <Th>سعر</Th>
                          <Th>الإجمالي</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.lineItems.map((li, i) => (
                          <Tr key={`${li.sku ?? li.name}-${i}`}>
                            <Td>{li.name}</Td>
                            <Td className="font-mono text-xs">{li.sku ?? "—"}</Td>
                            <Td className="tabular-nums">{li.quantity}</Td>
                            <Td className="tabular-nums">
                              {formatMoney(li.unit_price)}
                            </Td>
                            <Td className="font-semibold tabular-nums">
                              {formatMoney(li.line_total)}
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </TableWrap>
                  }
                  mobile={
                    <div className="space-y-3">
                      {o.lineItems.map((li, i) => (
                        <ResponsiveCard key={`${li.sku ?? li.name}-${i}`}>
                          <div className="space-y-2 text-sm">
                            <div className="font-medium text-[color:var(--color-text-primary)]">
                              {li.name}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[color:var(--color-text-secondary)]">
                              <div>
                                <div className="text-xs text-[color:var(--color-text-muted)]">
                                  SKU
                                </div>
                                <div className="font-mono text-xs">{li.sku ?? "—"}</div>
                              </div>
                              <div>
                                <div className="text-xs text-[color:var(--color-text-muted)]">
                                  الكمية
                                </div>
                                <div className="tabular-nums">{li.quantity}</div>
                              </div>
                              <div>
                                <div className="text-xs text-[color:var(--color-text-muted)]">
                                  سعر
                                </div>
                                <div className="tabular-nums">
                                  {formatMoney(li.unit_price)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-[color:var(--color-text-muted)]">
                                  الإجمالي
                                </div>
                                <div className="tabular-nums font-semibold">
                                  {formatMoney(li.line_total)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </ResponsiveCard>
                      ))}
                    </div>
                  }
                />
              ) : (
                <p className="rounded-xl bg-[color:var(--color-bg-subtle)] p-4 text-center text-sm text-[color:var(--color-text-muted)] shadow-[var(--shadow-neo-inset)]">
                  لا توجد بنود مسجلة (استورد من ووكومرس أو أضف يدوياً لاحقاً).
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>البوليصات (الشحن)</CardTitle>
            </CardHeader>
            <CardContent>
              {bundle.shipments.length === 0 ? (
                <p className="rounded-xl bg-[color:var(--color-bg-subtle)] p-4 text-center text-sm text-[color:var(--color-text-muted)] shadow-[var(--shadow-neo-inset)]">
                  لا شحنات بعد.
                </p>
              ) : (
                <ResponsiveTable
                  desktop={
                    <TableWrap>
                      <thead>
                        <tr>
                          <Th>تتبع (رقم البوليصة / AWB)</Th>
                          <Th>النوع</Th>
                          <Th>الحالة</Th>
                          <Th>حالة بوسطة</Th>
                          <Th>أنشأها</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {bundle.shipments.map((s) => (
                          <Tr key={s.id}>
                            <Td className="font-mono text-xs">{s.awb}</Td>
                            <Td>{s.type}</Td>
                            <Td>
                              <span className="rounded-full bg-[color:var(--color-muted-bg)] px-2 py-1 text-xs font-medium text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-inset)]">
                                {s.status}
                              </span>
                            </Td>
                            <Td>{s.carrierTrackingStatus ?? "—"}</Td>
                            <Td>
                              {s.createdByUserName ?? "—"}
                              {s.createdByUserId ? (
                                <span className="text-[color:var(--color-text-muted)]">
                                  {" "}
                                  ({s.createdByUserId})
                                </span>
                              ) : null}
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </TableWrap>
                  }
                  mobile={
                    <div className="space-y-3">
                      {bundle.shipments.map((s) => (
                        <ResponsiveCard key={s.id}>
                          <div className="space-y-3 text-sm">
                            <div>
                              <div className="text-xs text-[color:var(--color-text-muted)]">
                                تتبع (AWB)
                              </div>
                              <div className="font-mono text-xs break-all">
                                {s.awb}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[color:var(--color-text-secondary)]">
                              <div>
                                <div className="text-xs text-[color:var(--color-text-muted)]">
                                  النوع
                                </div>
                                <div>{s.type}</div>
                              </div>
                              <div>
                                <div className="text-xs text-[color:var(--color-text-muted)]">
                                  الحالة
                                </div>
                                <div>
                                  <span className="rounded-full bg-[color:var(--color-muted-bg)] px-2 py-1 text-xs font-medium shadow-[var(--shadow-neo-inset)]">
                                    {s.status}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-[color:var(--color-text-muted)]">
                                  حالة بوسطة
                                </div>
                                <div>{s.carrierTrackingStatus ?? "—"}</div>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-[color:var(--color-text-muted)]">
                                أنشأها
                              </div>
                              <div>
                                {s.createdByUserName ?? "—"}
                                {s.createdByUserId ? (
                                  <span className="text-[color:var(--color-text-muted)]">
                                    {" "}
                                    ({s.createdByUserId})
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </ResponsiveCard>
                      ))}
                    </div>
                  }
                />
              )}
            </CardContent>
          </Card>

          {o.woocommerceOrderSnapshot ? (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>بيانات WooCommerce الكاملة</CardTitle>
                <span className="rounded-full bg-[color:var(--color-muted-bg)] px-2 py-1 text-xs font-medium text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-inset)]">
                  Snapshot
                </span>
              </CardHeader>
              <CardContent>
                <details className="group">
                  <summary className="cursor-pointer list-none rounded-xl bg-[color:var(--color-bg-subtle)] p-3 text-sm font-medium text-[color:var(--color-primary)] shadow-[var(--shadow-neo-inset)] [&::-webkit-details-marker]:hidden">
                    <span>عرض / إخفاء الـ JSON</span>
                    <span className="ms-2 text-[color:var(--color-text-muted)] no-underline group-open:hidden">
                      (آخر استلام من الويب هوك)
                    </span>
                  </summary>
                  <pre
                    className={cn(
                      "mt-3 max-h-[min(480px,50vh)] overflow-auto rounded-xl border-0 shadow-[var(--shadow-neo-inset)]",
                      "bg-[color:var(--color-code-bg)] p-3 text-[11px] leading-relaxed [direction:ltr] [text-align:left]",
                    )}
                  >
                    {JSON.stringify(o.woocommerceOrderSnapshot, null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>سجل الإجراءات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {activities.length === 0 ? (
                <p className="rounded-xl bg-[color:var(--color-bg-subtle)] p-4 text-center text-[color:var(--color-text-muted)] shadow-[var(--shadow-neo-inset)]">
                  لا سجلات بعد.
                </p>
              ) : (
                <ul className="space-y-3 border-s-2 border-[color:var(--color-divider)] ps-4">
                  {activities.map((a) => (
                    <li
                      key={a.id}
                      className="relative rounded-xl bg-[color:var(--color-bg-subtle)] p-3 text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-raised-sm)]"
                    >
                      <span className="absolute -start-[21px] top-4 size-2 rounded-full bg-[color:var(--color-primary)] shadow-[var(--shadow-neo-raised-sm)]" />
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-medium text-[color:var(--color-text-primary)]">
                          {a.action}
                        </span>
                        <span className="text-xs text-[color:var(--color-text-muted)]">
                          {new Date(a.timestamp).toLocaleString("ar-EG")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                        {userName(a.userId)}
                      </p>
                      {a.metadata && Object.keys(a.metadata).length > 0 ? (
                        <pre
                          className={cn(
                            "mt-3 overflow-x-auto rounded-lg border-0 shadow-[var(--shadow-neo-inset)]",
                            "bg-[color:var(--color-code-bg)] p-2 text-[11px]",
                          )}
                        >
                          {JSON.stringify(a.metadata, null, 2)}
                        </pre>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
