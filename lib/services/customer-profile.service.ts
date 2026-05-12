import { normalizeCustomerPhone } from "@/lib/logic/phone-normalize";
import { findConversationByCustomerPhone } from "@/lib/services/chat/conversations.service";
import { queryOrderByTenantAndField } from "@/lib/repositories/orders.repository";
import { listShipmentsForOrder } from "@/lib/services/shipments.service";
import { listTickets } from "@/lib/services/tickets.service";
import type { ChatConversation } from "@/lib/types/chat";
import type { Order, Shipment, Ticket } from "@/lib/types/models";

export type CustomerProfile = {
  phone: string;
  conversation: ChatConversation | null;
  orders: Order[];
  cancelCount: number;
  returnCount: number;
  lastAddress: string | null;
  lastOrderAt: string | null;
  tickets: Ticket[];
  shipments: Shipment[];
  /** 0–100 weighted heuristic: cancellations + returns + open tickets. */
  riskScore: number;
};

export async function getCustomerProfile(input: {
  tenantId: string;
  rawPhone: string;
}): Promise<CustomerProfile | null> {
  const phone = normalizeCustomerPhone(input.rawPhone);
  if (!phone) return null;

  let orders = await queryOrderByTenantAndField(
    input.tenantId,
    "customer.phone",
    phone,
    200,
  );

  if (orders.length === 0) {
    const alt = input.rawPhone.trim();
    if (alt && alt !== phone) {
      orders = await queryOrderByTenantAndField(
        input.tenantId,
        "customer.phone",
        alt,
        200,
      );
    }
  }

  orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const cancelCount = orders.filter((o) => o.status === "cancelled").length;
  const returnCount = orders.filter(
    (o) => o.status === "returned" || o.status === "exchange_requested",
  ).length;

  const latest = orders[0];
  const lastAddress = (latest?.customer.address ?? "").trim() || null;

  const conversation =
    (await findConversationByCustomerPhone(input.tenantId, phone)) ?? null;

  const orderIds = new Set(orders.map((o) => o.id));
  const allTickets = await listTickets(input.tenantId);
  const tickets = allTickets
    .filter((t) => orderIds.has(t.order_id))
    .slice(0, 80);

  const shipments: Shipment[] = [];
  for (const o of orders.slice(0, 40)) {
    const s = await listShipmentsForOrder(input.tenantId, o.id);
    shipments.push(...s);
  }

  const openTickets = tickets.filter((t) => t.status === "open").length;
  const riskScore = Math.min(
    100,
    cancelCount * 14 + returnCount * 12 + openTickets * 10,
  );

  return {
    phone,
    conversation,
    orders,
    cancelCount,
    returnCount,
    lastAddress,
    lastOrderAt: latest?.createdAt ?? null,
    tickets,
    shipments,
    riskScore,
  };
}
