"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, Maximize2, Package } from "lucide-react";
import type { Order } from "@/lib/types/models";
import { OrderStatusBadge, PaymentBadge } from "@/lib/ui/order-badges";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  NotionPropertyList,
  NotionPropertyRow,
  NotionSectionTitle,
} from "@/components/ui/notion-blocks";
import { cn } from "@/lib/ui/cn";

function orderNeedsDetailFetch(o: Order) {
  const hasLines = Boolean(o.lineItems && o.lineItems.length > 0);
  const hasAddress = Boolean(o.customer.address?.trim());
  return !hasLines || !hasAddress;
}

async function fetchOrderById(
  id: string,
  headers: Record<string, string>,
): Promise<Order | null> {
  const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, { headers });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { order?: Order };
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json.data?.order ?? null;
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
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

export function OrderPeekPanel({
  initial,
  headers,
  canViewFinance,
}: {
  initial: Order;
  headers: Record<string, string>;
  canViewFinance: boolean;
}) {
  const { t } = useLocale();
  const [order, setOrder] = useState(initial);
  const [loadingDetail, setLoadingDetail] = useState(() =>
    orderNeedsDetailFetch(initial),
  );
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  useEffect(
    () => {
      setOrder(initial);
      const needsFetch = orderNeedsDetailFetch(initial);
      setFetchErr(null);
      if (!needsFetch) {
        setLoadingDetail(false);
        return;
      }
      setLoadingDetail(true);
      let cancelled = false;
      void (async () => {
        try {
          const full = await fetchOrderById(initial.id, headers);
          if (cancelled) return;
          if (full) setOrder(full);
        } catch (e) {
          if (!cancelled) {
            setFetchErr(e instanceof Error ? e.message : "Failed to load details");
          }
        } finally {
          if (!cancelled) setLoadingDetail(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- primitive deps: avoid refetch when parent recreates the order object
    [initial.id, initial.lineItems?.length, initial.customer.address, headers],
  );

  const lines = order.lineItems ?? [];
  const addressText = order.customer.address?.trim();
  const fullPageHref = `/orders/${order.id}`;

  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 border-b border-[color:var(--color-divider)] pb-4">
        <div className="min-w-0 space-y-2">
          <p className="font-mono text-lg font-semibold tracking-tight text-[color:var(--color-text-primary)]">
            #{displayOrderId(order)}
          </p>
          <p className="text-[12px] text-[color:var(--color-text-muted)]">
            Updated {formatWhen(order.updatedAt)}
          </p>
          <div className="flex flex-wrap gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentBadge status={order.payment.payment_status} />
          </div>
        </div>
        <Link
          href={fullPageHref}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-[var(--ds-radius-md)]",
            "border border-[color:var(--color-border)] text-[color:var(--color-text-secondary)]",
            "transition-colors hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]",
          )}
          title={t("Open full order page")}
          aria-label={t("Open full order page")}
        >
          <Maximize2 className="size-4" aria-hidden />
        </Link>
      </div>

      <section className="space-y-2">
        <NotionSectionTitle>{t("Customer")}</NotionSectionTitle>
        <div className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] px-3 py-2.5 text-[13px]">
          <p className="font-medium text-[color:var(--color-text-primary)]">
            {order.customer.name}
          </p>
          <p className="mt-1 text-[color:var(--color-text-secondary)]">
            {order.customer.phone ?? "—"}
          </p>
          {order.customer.email ? (
            <p className="mt-0.5 truncate text-[color:var(--color-text-muted)]">
              {order.customer.email}
            </p>
          ) : null}
          {loadingDetail && !addressText ? (
            <div
              className="mt-3 h-10 animate-pulse rounded-md bg-[color:var(--color-skeleton)] motion-reduce:animate-none"
              aria-hidden
            />
          ) : addressText ? (
            <div className="mt-3 border-t border-[color:var(--color-divider)] pt-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[color:var(--color-text-muted)]">
                <MapPin className="size-3.5 shrink-0 opacity-80" aria-hidden />
                {t("Address")}
              </p>
              <p className="whitespace-pre-wrap leading-relaxed text-[color:var(--color-text-secondary)]">
                {addressText}
              </p>
            </div>
          ) : (
            <p className="mt-3 border-t border-[color:var(--color-divider)] pt-3 text-[12px] text-[color:var(--color-text-muted)]">
              {t("No address on file.")}
            </p>
          )}
        </div>
      </section>

      {canViewFinance ? (
        <section className="space-y-2">
          <NotionSectionTitle>Payment</NotionSectionTitle>
          <NotionPropertyList>
            <NotionPropertyRow name="Total">
              <span className="font-semibold tabular-nums">
                {formatMoney(order.payment.total_amount)}
              </span>
            </NotionPropertyRow>
            {order.payment.payment_status === "partial" ||
            order.payment.paid_amount > 0 ? (
              <NotionPropertyRow name="Paid">
                <span className="font-medium tabular-nums">
                  {formatMoney(order.payment.paid_amount)}
                </span>
              </NotionPropertyRow>
            ) : null}
          </NotionPropertyList>
        </section>
      ) : null}

      <section className="space-y-2">
        <NotionSectionTitle className="flex items-center gap-2">
          <Package className="size-3.5 opacity-70" aria-hidden />
          Products
        </NotionSectionTitle>
        {loadingDetail && lines.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-[13px] text-[color:var(--color-text-muted)]">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("Loading line items…")}
          </div>
        ) : fetchErr ? (
          <p className="text-[13px] text-[color:var(--color-text-secondary)]">
            {fetchErr} — open the full page for complete items.
          </p>
        ) : lines.length === 0 ? (
          <p className="text-[13px] text-[color:var(--color-text-muted)]">
            No line items on file. See full order for details.
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--color-divider)] rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-card)]">
            {lines.map((line, idx) => (
              <li
                key={line.id ?? `${line.name}-${idx}`}
                className="flex gap-3 px-3 py-2.5 text-[13px]"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug text-[color:var(--color-text-primary)]">
                    {line.name}
                  </p>
                  {line.sku ? (
                    <p className="mt-0.5 font-mono text-[11px] text-[color:var(--color-text-muted)]">
                      SKU {line.sku}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-end tabular-nums">
                  <span className="text-[color:var(--color-text-muted)]">
                    ×{line.quantity}
                  </span>
                  {canViewFinance ? (
                    <p className="font-medium text-[color:var(--color-text-primary)]">
                      {formatMoney(line.line_total)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(order.latestShipmentAwb || order.notes?.trim()) ? (
        <section className="space-y-2">
          <NotionSectionTitle>Shipping & notes</NotionSectionTitle>
          {order.latestShipmentAwb ? (
            <p className="font-mono text-[12px] text-[color:var(--color-text-secondary)]">
              AWB {order.latestShipmentAwb}
              {order.latestShipmentCarrierTrackingStatus
                ? ` · ${order.latestShipmentCarrierTrackingStatus}`
                : null}
            </p>
          ) : null}
          {order.notes?.trim() ? (
            <p className="line-clamp-4 text-[13px] leading-relaxed text-[color:var(--color-text-secondary)]">
              {order.notes.trim()}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="border-t border-[color:var(--color-divider)] pt-4">
        <Link
          href={fullPageHref}
          className={cn(
            "inline-flex min-h-9 w-full items-center justify-center rounded-[var(--ds-radius-md)]",
            "bg-[color:var(--color-primary)] px-4 py-2 text-[13px] font-medium text-[color:var(--color-primary-contrast)]",
            "transition-colors hover:bg-[color:var(--color-primary-hover)]",
          )}
        >
          {t("Open full order page")}
        </Link>
      </div>
    </div>
  );
}
