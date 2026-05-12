import type { Order, OrderStatus } from "@/lib/types/models";

export type OrderOverdueAlert = {
  orderId: string;
  displayOrderId: string;
  customerName: string;
  status: OrderStatus;
  nextAction: string;
  thresholdMinutes: number;
  ageMinutes: number;
  updatedAt: string;
  assignedTo?: string | null;
};

const THRESHOLDS: Partial<
  Record<OrderStatus, { minutes: number; nextAction: string }>
> = {
  pending_confirmation: {
    minutes: 30,
    nextAction: "تأكيد الطلب أو إلغاؤه",
  },
  confirmed: {
    minutes: 60,
    nextAction: "إصدار الفاتورة وتجهيز الطلب للمخزن",
  },
  invoice_required: {
    minutes: 120,
    nextAction: "إنهاء الفوترة ونقل الطلب للمخزن",
  },
  invoiced: {
    minutes: 120,
    nextAction: "تجهيز الشحن وإنشاء البوليصة",
  },
  ready_for_shipping: {
    minutes: 120,
    nextAction: "تجهيز/تعبئة الطلب في المخزن",
  },
  awb_created: {
    minutes: 90,
    nextAction: "بدء الالتقاط أو التعبئة",
  },
  warehouse_picking: {
    minutes: 90,
    nextAction: "إكمال الالتقاط",
  },
  warehouse_packed: {
    minutes: 60,
    nextAction: "تسليم الشحنة للناقل",
  },
  out_for_shipping: {
    minutes: 1440,
    nextAction: "متابعة التسليم أو تحديث الحالة",
  },
  failed_delivery: {
    minutes: 1440,
    nextAction: "متابعة إعادة المحاولة أو الإرجاع",
  },
};

function ageMinutesSince(iso: string, nowMs: number) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((nowMs - t) / 60000));
}

export function computeOrderOverdueAlerts(
  orders: Order[],
  now = new Date(),
): OrderOverdueAlert[] {
  const nowMs = now.getTime();
  return orders
    .flatMap((order) => {
      const rule = THRESHOLDS[order.status];
      if (!rule) return [];

      const ageMinutes = ageMinutesSince(order.updatedAt, nowMs);
      if (ageMinutes < rule.minutes) return [];

      return [
        {
          orderId: order.id,
          displayOrderId:
            order.wooCommerceOrderId?.trim() || order.id.slice(0, 8).toUpperCase(),
          customerName: order.customer.name,
          status: order.status,
          nextAction: rule.nextAction,
          thresholdMinutes: rule.minutes,
          ageMinutes,
          updatedAt: order.updatedAt,
          assignedTo: order.assigned_to,
        },
      ];
    })
    .sort((a, b) => b.ageMinutes - a.ageMinutes);
}
