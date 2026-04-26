"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
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

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const authReady = useSessionStore((s) => s.authReady);

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [nav, setNav] = useState(() => readOrderNav());
  const [whatsappTemplate, setWhatsappTemplate] = useState(
    defaultTenantAutomation.whatsappMessageTemplate!,
  );

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
          data: { whatsappMessageTemplate: string };
        };
        if (wJson.data?.whatsappMessageTemplate) {
          setWhatsappTemplate(wJson.data.whatsappMessageTemplate);
        } else {
          setWhatsappTemplate(
            defaultTenantAutomation.whatsappMessageTemplate!,
          );
        }
      } else {
        setWhatsappTemplate(
          defaultTenantAutomation.whatsappMessageTemplate!,
        );
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

  async function onWhatsApp() {
    const o = bundle?.order;
    const shipments = bundle?.shipments;
    if (!o?.customer.phone) return;
    const deliveryAwb =
      shipments?.find((s) => s.type === "delivery")?.awb?.trim() ?? "—";
    const body = formatConfirmationWhatsAppMessage(whatsappTemplate, {
      name: o.customer.name,
      orderId: o.id,
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={loading ? "تفاصيل الطلب" : `طلب ${o?.id.slice(0, 8)}…`}
        description="عنوان، بنود، شحن، دفع، بوليصات، سجل الإجراءات."
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
        <p className="rounded-lg border border-[color:var(--color-error)]/40 bg-[color:var(--color-error)]/10 p-3 text-sm text-[color:var(--color-error)]">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-lg border border-[color:var(--color-success)]/40 bg-[color:var(--color-success)]/10 p-3 text-sm text-[color:var(--color-success)]">
          {msg}
        </p>
      ) : null}

      {loading ? (
        <OrderDetailSkeleton />
      ) : o ? (
        <>
          <div className="flex flex-wrap gap-2">
            {can(role, "order:confirm") && o.status === "pending_confirmation" ? (
              <Button type="button" onClick={onConfirm}>
                تأكيد الطلب
              </Button>
            ) : null}
            {can(role, "order:cancel") && o.status !== "cancelled" ? (
              <Button type="button" variant="danger" onClick={onCancel}>
                إلغاء
              </Button>
            ) : null}
            {can(role, "order:invoice") &&
            (o.status === "confirmed" || o.status === "invoicing") ? (
              <Button type="button" variant="secondary" onClick={onInvoice}>
                فوترة / جاهز للمخزن
              </Button>
            ) : null}
            {can(role, "order:assign") ? (
              <Button type="button" variant="ghost" size="sm" onClick={onAssign}>
                تعيين
              </Button>
            ) : null}
            {can(role, "order:confirm") && o.customer.phone ? (
              <Button type="button" variant="secondary" onClick={onWhatsApp}>
                واتساب + تسجيل
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>العميل والعنوان</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-[color:var(--color-text-muted)]">الاسم</span>
                  <div className="font-medium">{o.customer.name}</div>
                </div>
                <div>
                  <span className="text-[color:var(--color-text-muted)]">الهاتف</span>
                  <div>{o.customer.phone ?? "—"}</div>
                </div>
                <div>
                  <span className="text-[color:var(--color-text-muted)]">البريد</span>
                  <div>{o.customer.email ?? "—"}</div>
                </div>
                <div>
                  <span className="text-[color:var(--color-text-muted)]">العنوان</span>
                  <div>{o.customer.address ?? "—"}</div>
                </div>
                {o.notes ? (
                  <div>
                    <span className="text-[color:var(--color-text-muted)]">ملاحظات</span>
                    <div>{o.notes}</div>
                  </div>
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-[color:var(--color-text-muted)]">الإجمالي</div>
                    <div className="font-semibold">{o.payment.total_amount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[color:var(--color-text-muted)]">المدفوع</div>
                    <div>{o.payment.paid_amount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[color:var(--color-text-muted)]">المتبقي</div>
                    <div>{o.payment.remaining_amount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[color:var(--color-text-muted)]">التحصيل عند الاستلام</div>
                    <div>{o.payment.cod_amount}</div>
                  </div>
                </div>
                {o.invoice ? (
                  <div>
                    <div className="text-xs text-[color:var(--color-text-muted)]">فاتورة</div>
                    <div>
                      {o.invoice.number} — {o.invoice.issuedAt ?? ""}
                    </div>
                  </div>
                ) : null}
                {o.wooCommerceOrderId ? (
                  <div>
                    <div className="text-xs text-[color:var(--color-text-muted)]">WooCommerce</div>
                    <div className="font-mono text-xs">{o.wooCommerceOrderId}</div>
                  </div>
                ) : null}
                {o.assigned_to ? (
                  <div>
                    <div className="text-xs text-[color:var(--color-text-muted)]">معيّن إلى</div>
                    <div>
                      {userName(o.assigned_to)} ({o.assigned_to})
                    </div>
                  </div>
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
                <div className="text-sm">
                  <span className="text-[color:var(--color-text-muted)]">الشحن: </span>
                  {o.shipping.method ?? "—"} — {o.shipping.cost}
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
                            <Td>{li.quantity}</Td>
                            <Td>{li.unit_price}</Td>
                            <Td>{li.line_total}</Td>
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
                                <div className="tabular-nums">{li.unit_price}</div>
                              </div>
                              <div>
                                <div className="text-xs text-[color:var(--color-text-muted)]">
                                  الإجمالي
                                </div>
                                <div className="tabular-nums font-semibold">
                                  {li.line_total}
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
                <p className="text-sm text-[color:var(--color-text-muted)]">
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
                <p className="text-sm text-[color:var(--color-text-muted)]">لا شحنات بعد.</p>
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
                            <Td>{s.status}</Td>
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
                          <div className="space-y-2 text-sm">
                            <div>
                              <div className="text-xs text-[color:var(--color-text-muted)]">
                                تتبع (AWB)
                              </div>
                              <div className="font-mono text-xs break-all">
                                {s.awb}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
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
                                <div>{s.status}</div>
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

          <Card>
            <CardHeader>
              <CardTitle>سجل الإجراءات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {activities.length === 0 ? (
                <p className="text-[color:var(--color-text-muted)]">لا سجلات بعد.</p>
              ) : (
                <ul className="space-y-2 border-s-2 border-[color:var(--color-border)] ps-3">
                  {activities.map((a) => (
                    <li key={a.id} className="text-[color:var(--color-text-secondary)]">
                      <span className="font-medium text-[color:var(--color-text-primary)]">
                        {a.action}
                      </span>{" "}
                      — {userName(a.userId)}{" "}
                      <span className="text-xs text-[color:var(--color-text-muted)]">
                        {new Date(a.timestamp).toLocaleString("ar-EG")}
                      </span>
                      {a.metadata && Object.keys(a.metadata).length > 0 ? (
                        <pre
                          className={cn(
                            "mt-1 overflow-x-auto rounded border border-[color:var(--color-code-border)]",
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
