"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  PackageCheck,
  Trash2,
  Truck,
  UserRound,
  WalletCards,
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
  User,
} from "@/lib/types/models";
import { OrderStatusBadge, PaymentBadge } from "@/lib/ui/order-badges";
import {
  navNeighbors,
  readOrderNav,
  setOrderNav,
} from "@/lib/ui/order-nav-storage";
import { buildWhatsAppUrl } from "@/lib/ui/whatsapp";
import { formatConfirmationWhatsAppMessage } from "@/lib/logic/confirmation-whatsapp";
import { defaultTenantAutomation } from "@/lib/types/models";
import { cn } from "@/lib/ui/cn";

type Bundle = { order: Order; shipments: Shipment[] };

function displayOrderId(order: Order) {
  return order.wooCommerceOrderId?.trim() || order.id.slice(0, 8).toUpperCase();
}

function formatMoney(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
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
  const [nav, setNav] = useState(() => readOrderNav());
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
    try {
      const [bRes, aRes, uRes, wRes] = await Promise.all([
        fetch(`/api/orders/${orderId}`, { headers }),
        fetch(
          `/api/activity?entityType=order&entityId=${encodeURIComponent(orderId)}&limit=80`,
          { headers },
        ),
        fetch("/api/users", { headers }),
        fetch("/api/settings/confirmation-whatsapp", { headers }),
      ]);
      const bJson = await bRes.json();
      const aJson = await aRes.json();
      const uJson = await uRes.json();
      if (!bRes.ok) throw new Error(bJson.error ?? bRes.statusText);
      if (!aRes.ok) throw new Error(aJson.error ?? aRes.statusText);
      if (!uRes.ok) throw new Error(uJson.error ?? uRes.statusText);
      setBundle(bJson.data as Bundle);
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
    } finally {
      setLoading(false);
    }
  }, [orderId, headers]);

  useEffect(() => {
    if (!authReady) return;
    void load();
  }, [authReady, load]);

  useEffect(() => {
    setNav(readOrderNav());
  }, [orderId]);

  const { prevId, nextId } = useMemo(() => {
    if (!nav?.ids?.length) return { prevId: null, nextId: null };
    const { prevId: p, nextId: n } = navNeighbors(orderId, nav.ids);
    return { prevId: p, nextId: n };
  }, [nav, orderId]);

  function goOrder(targetId: string) {
    if (!nav?.ids?.length) {
      router.push(`/orders/${targetId}`);
      return;
    }
    setOrderNav(nav.ids, targetId);
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
      await postJson("/api/orders/confirm", { orderId });
      setMsg("تم تأكيد الطلب.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "فشل");
    }
  }

  async function onCancel() {
    if (!window.confirm("تأكيد إلغاء الطلب؟")) return;
    try {
      await postJson("/api/orders/cancel", { orderId });
      setMsg("تم إلغاء الطلب.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "فشل");
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
      router.push("/orders");
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
    const displayOrderId = o.wooCommerceOrderId?.trim() || o.id;
    const wooOrderId = o.wooCommerceOrderId?.trim() || "";
    const orderLink = orderLinkTemplate
      .replaceAll("{wooOrderId}", wooOrderId || displayOrderId)
      .replaceAll("{orderId}", displayOrderId)
      .trim();
    const body = formatConfirmationWhatsAppMessage(whatsappTemplate, {
      name: o.customer.name,
      orderId: displayOrderId,
      wooOrderId: wooOrderId || undefined,
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
          <div className="rounded-2xl border-0 bg-[color:var(--color-card)] p-4 shadow-[var(--shadow-neo-raised)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <OrderStatusBadge status={o.status} />
                  <PaymentBadge status={o.payment.payment_status} />
                </div>
                <p className="text-sm text-[color:var(--color-text-secondary)]">
                  إدارة سريعة للطلب مع الاحتفاظ بسجل كل إجراء يتم تنفيذه.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {can(permissionSubject, "order:confirm") &&
                o.status === "pending_confirmation" ? (
                  <Button type="button" onClick={onConfirm}>
                    تأكيد الطلب
                  </Button>
                ) : null}
                {can(permissionSubject, "order:cancel") && o.status !== "cancelled" ? (
                  <Button type="button" variant="danger" onClick={onCancel}>
                    إلغاء
                  </Button>
                ) : null}
                {can(permissionSubject, "order:invoice") &&
                (o.status === "confirmed" || o.status === "invoicing") ? (
                  <Button type="button" variant="secondary" onClick={onInvoice}>
                    فوترة / جاهز للمخزن
                  </Button>
                ) : null}
                {can(permissionSubject, "order:assign") ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onAssign}
                  >
                    تعيين
                  </Button>
                ) : null}
                {can(permissionSubject, "order:confirm") && o.customer.phone ? (
                  <Button type="button" variant="secondary" onClick={onWhatsApp}>
                    واتساب + تسجيل
                  </Button>
                ) : null}
                {can(permissionSubject, "order:delete") ? (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    loading={deleting}
                    onClick={onDelete}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    حذف نهائي
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Customer"
              value={o.customer.name}
              detail={o.customer.phone ?? o.customer.email ?? "لا توجد وسيلة تواصل"}
              icon={<UserRound className="size-5" aria-hidden />}
            />
            <SummaryCard
              label="Order total"
              value={canViewFinance ? formatMoney(o.payment.total_amount) : "Hidden"}
              detail={
                canViewFinance
                  ? `متبقي ${formatMoney(o.payment.remaining_amount)}`
                  : "Financial permission required"
              }
              icon={<WalletCards className="size-5" aria-hidden />}
            />
            <SummaryCard
              label="Shipments"
              value={`${bundle.shipments.length} بوليصة`}
              detail={`AWB: ${deliveryAwb}`}
              icon={<Truck className="size-5" aria-hidden />}
            />
            <SummaryCard
              label="Items"
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
