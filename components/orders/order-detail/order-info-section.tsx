"use client";

import Link from "next/link";
import { ExternalLink, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  NotionPropertyField,
  NotionPropertyList,
  NotionPropertyRow,
} from "@/components/ui/notion-blocks";
import { ResponsiveCard } from "@/components/responsive/ResponsiveCard";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { OrderStatusBadge, PaymentBadge } from "@/lib/ui/order-badges";
import { cn } from "@/lib/ui/cn";
import type { Order } from "@/lib/types/models";

type OrderInfoSectionProps = {
  order: Order;
  canViewFinance: boolean;
  whatsappUser?: string;
  userName: (id: string) => string;
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

export function OrderInfoSection({
  order,
  canViewFinance,
  whatsappUser,
  userName,
}: OrderInfoSectionProps) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>العميل والعنوان</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <NotionPropertyList>
              <NotionPropertyRow name="الاسم">
                <span className="font-medium">{order.customer.name}</span>
              </NotionPropertyRow>
              <NotionPropertyRow name="الهاتف">
                <span className="flex flex-wrap items-center gap-2">
                  {order.customer.phone ?? "—"}
                  {order.customer.phone?.trim() ? (
                    <Link
                      href={`/customers?phone=${encodeURIComponent(order.customer.phone.trim())}`}
                      className="text-xs font-medium text-[color:var(--color-primary)] underline-offset-2 hover:underline"
                    >
                      ملف العميل
                    </Link>
                  ) : null}
                </span>
              </NotionPropertyRow>
              <NotionPropertyRow name="البريد">
                {order.customer.email ?? "—"}
              </NotionPropertyRow>
              <NotionPropertyRow name="العنوان">
                {order.customer.address ?? "—"}
              </NotionPropertyRow>
              {order.notes ? (
                <NotionPropertyRow name="ملاحظات">
                  <span className="block rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-3 text-[13px] leading-relaxed">
                    {order.notes}
                  </span>
                </NotionPropertyRow>
              ) : null}
            </NotionPropertyList>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>الدفع والحالة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <OrderStatusBadge status={order.status} />
              <PaymentBadge status={order.payment.payment_status} />
            </div>
            {canViewFinance ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <NotionPropertyField name="الإجمالي">
                  <span className="font-semibold tabular-nums">
                    {formatMoney(order.payment.total_amount)}
                  </span>
                </NotionPropertyField>
                <NotionPropertyField name="المدفوع">
                  <span className="tabular-nums">
                    {formatMoney(order.payment.paid_amount)}
                  </span>
                </NotionPropertyField>
                <NotionPropertyField name="المتبقي">
                  <span className="tabular-nums">
                    {formatMoney(order.payment.remaining_amount)}
                  </span>
                </NotionPropertyField>
                <NotionPropertyField name="التحصيل عند الاستلام">
                  <span className="tabular-nums">
                    {formatMoney(order.payment.cod_amount)}
                  </span>
                </NotionPropertyField>
              </div>
            ) : (
              <p className="rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-3 text-xs text-[color:var(--color-text-muted)]">
                تفاصيل المبالغ مخفية حسب صلاحيات المستخدم.
              </p>
            )}
            {order.invoice ||
            order.wooCommerceOrderId ||
            order.whatsappSentAt ||
            order.assigned_to ||
            order.cancelReason ? (
              <NotionPropertyList>
                {order.invoice ? (
                  <NotionPropertyRow name="فاتورة">
                    <span className="font-mono text-xs">
                      {order.invoice.number} — {order.invoice.issuedAt ?? ""}
                    </span>
                  </NotionPropertyRow>
                ) : null}
                {order.wooCommerceOrderId ? (
                  <NotionPropertyRow name="WooCommerce">
                    {order.wooCommerceOrderAdminUrl ? (
                      <a
                        href={order.wooCommerceOrderAdminUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[color:var(--color-primary)] hover:underline"
                      >
                        #{order.wooCommerceOrderId}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : (
                      <div className="font-mono text-xs">
                        {order.wooCommerceOrderId}
                      </div>
                    )}
                  </NotionPropertyRow>
                ) : null}
                {order.whatsappSentAt ? (
                  <NotionPropertyRow name="واتساب">
                    <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-[color:var(--color-success)]/12 px-2 py-1 text-xs font-medium text-[color:var(--color-success)]">
                      <MessageCircle className="size-3.5" aria-hidden />
                      <span>تم الإرسال</span>
                      <span>بواسطة {whatsappUser ?? "مستخدم"}</span>
                      <span>· {formatWhen(order.whatsappSentAt)}</span>
                    </div>
                  </NotionPropertyRow>
                ) : null}
                {order.assigned_to ? (
                  <NotionPropertyRow name="معيّن إلى">
                    <span>
                      {userName(order.assigned_to)} ({order.assigned_to})
                    </span>
                  </NotionPropertyRow>
                ) : null}
                {order.cancelReason ? (
                  <NotionPropertyRow name="سبب الإلغاء">
                    <span className="block rounded-[var(--ds-radius-md)] bg-[color:var(--color-error)]/10 p-3 text-[color:var(--color-error)]">
                      {order.cancelReason}
                      {order.cancelledAt ? ` · ${formatWhen(order.cancelledAt)}` : ""}
                    </span>
                  </NotionPropertyRow>
                ) : null}
              </NotionPropertyList>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>المنتجات والشحن</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.shipping ? (
            <div className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-3 sm:p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <NotionPropertyField name="طريقة الشحن">
                  {order.shipping.method ?? "—"}
                </NotionPropertyField>
                <NotionPropertyField name="تكلفة الشحن">
                  <span className="font-semibold tabular-nums">
                    {formatMoney(order.shipping.cost)}
                  </span>
                </NotionPropertyField>
              </div>
            </div>
          ) : null}
          {order.lineItems?.length ? (
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
                    {order.lineItems.map((lineItem, index) => (
                      <Tr key={`${lineItem.sku ?? lineItem.name}-${index}`}>
                        <Td>{lineItem.name}</Td>
                        <Td className="font-mono text-xs">{lineItem.sku ?? "—"}</Td>
                        <Td className="tabular-nums">{lineItem.quantity}</Td>
                        <Td className="tabular-nums">
                          {formatMoney(lineItem.unit_price)}
                        </Td>
                        <Td className="font-semibold tabular-nums">
                          {formatMoney(lineItem.line_total)}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </TableWrap>
              }
              mobile={
                <div className="space-y-3">
                  {order.lineItems.map((lineItem, index) => (
                    <ResponsiveCard key={`${lineItem.sku ?? lineItem.name}-${index}`}>
                      <div className="space-y-2 text-sm">
                        <div className="font-medium text-[color:var(--color-text-primary)]">
                          {lineItem.name}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[color:var(--color-text-secondary)]">
                          <div>
                            <div className="text-xs text-[color:var(--color-text-muted)]">
                              SKU
                            </div>
                            <div className="font-mono text-xs">
                              {lineItem.sku ?? "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-[color:var(--color-text-muted)]">
                              الكمية
                            </div>
                            <div className="tabular-nums">{lineItem.quantity}</div>
                          </div>
                          <div>
                            <div className="text-xs text-[color:var(--color-text-muted)]">
                              سعر
                            </div>
                            <div className="tabular-nums">
                              {formatMoney(lineItem.unit_price)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-[color:var(--color-text-muted)]">
                              الإجمالي
                            </div>
                            <div className="tabular-nums font-semibold">
                              {formatMoney(lineItem.line_total)}
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
            <p className="rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-4 text-center text-sm text-[color:var(--color-text-muted)]">
              لا توجد بنود مسجلة (استورد من ووكومرس أو أضف يدوياً لاحقاً).
            </p>
          )}
        </CardContent>
      </Card>

      {order.woocommerceOrderSnapshot ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>بيانات WooCommerce الكاملة</CardTitle>
            <span className="rounded-full bg-[color:var(--color-muted-bg)] px-2 py-1 text-xs font-medium text-[color:var(--color-text-secondary)]">
              Snapshot
            </span>
          </CardHeader>
          <CardContent>
            <details className="group">
              <summary className="cursor-pointer list-none rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-3 text-sm font-medium text-[color:var(--color-primary)] [&::-webkit-details-marker]:hidden">
                <span>عرض / إخفاء الـ JSON</span>
                <span className="ms-2 text-[color:var(--color-text-muted)] no-underline group-open:hidden">
                  (آخر استلام من الويب هوك)
                </span>
              </summary>
              <pre
                className={cn(
                  "mt-3 max-h-[min(480px,50vh)] overflow-auto rounded-[var(--ds-radius-md)] border-0",
                  "bg-[color:var(--color-code-bg)] p-3 text-[11px] leading-relaxed [direction:ltr] [text-align:left]",
                )}
              >
                {JSON.stringify(order.woocommerceOrderSnapshot, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
