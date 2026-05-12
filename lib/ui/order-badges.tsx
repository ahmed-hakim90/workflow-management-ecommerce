import type {
  OrderStatus,
  PaymentStatus,
  TicketStatus,
  TicketType,
} from "@/lib/types/models";
import { Badge } from "@/components/ui/badge";

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const tone =
    status === "paid"
      ? "success"
      : status === "cod"
        ? "warning"
        : "info";
  return <Badge tone={tone}>{status}</Badge>;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tone =
    status === "cancelled"
      ? "danger"
      : status === "delivered" ||
          status === "closed" ||
          status === "out_for_shipping"
        ? "success"
        : status === "pending_confirmation" || status === "new"
          ? "warning"
          : status === "failed_delivery" ||
              status === "returned" ||
              status === "exchange_requested"
            ? "danger"
            : "default";
  return <Badge tone={tone}>{status}</Badge>;
}

export function TicketTypeBadge({ type }: { type: TicketType }) {
  return <Badge tone="info">{type}</Badge>;
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const tone =
    status === "resolved" || status === "closed"
      ? "success"
      : status === "open"
        ? "warning"
        : "default";
  return <Badge tone={tone}>{status}</Badge>;
}
