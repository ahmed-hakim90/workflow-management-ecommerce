"use client";

import { PackageCheck, Truck, UserRound, WalletCards } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Order, Shipment } from "@/lib/types/models";

type OrderSummaryCardsProps = {
  order: Order;
  shipments: Shipment[];
  canViewFinance: boolean;
};

function formatMoney(value: number) {
  return value.toLocaleString("ar-EG-u-nu-latn", {
    style: "currency",
    currency: "EGP",
  });
}

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

function latestAwb(shipments: Shipment[]) {
  return shipments.find((shipment) => shipment.type === "delivery")?.awb?.trim() ?? "—";
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
              {label}
            </p>
            <div className="text-lg font-semibold leading-snug tracking-tight text-[color:var(--color-text-primary)]">
              {value}
            </div>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--ds-radius-md)] bg-[color:var(--color-muted-bg)] text-[color:var(--color-text-secondary)] ring-1 ring-[color:var(--color-border)]">
            {icon}
          </span>
        </div>
        {detail ? (
          <p className="text-xs text-[color:var(--color-text-muted)]">{detail}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function OrderSummaryCards({
  order,
  shipments,
  canViewFinance,
}: OrderSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        label="العميل"
        value={order.customer.name}
        detail={order.customer.phone ?? order.customer.email ?? "لا توجد وسيلة تواصل"}
        icon={<UserRound className="size-5" aria-hidden />}
      />
      <SummaryCard
        label="إجمالي الطلب"
        value={canViewFinance ? formatMoney(order.payment.total_amount) : "مخفي"}
        detail={
          canViewFinance
            ? `متبقي ${formatMoney(order.payment.remaining_amount)}`
            : "يتطلب صلاحية عرض المالية"
        }
        icon={<WalletCards className="size-5" aria-hidden />}
      />
      <SummaryCard
        label="الشحنات"
        value={`${shipments.length} بوليصة`}
        detail={`AWB: ${latestAwb(shipments)}`}
        icon={<Truck className="size-5" aria-hidden />}
      />
      <SummaryCard
        label="الأصناف"
        value={`${order.lineItems?.length ?? 0} صنف`}
        detail={`تم إنشاء الطلب ${formatWhen(order.createdAt)}`}
        icon={<PackageCheck className="size-5" aria-hidden />}
      />
    </div>
  );
}
