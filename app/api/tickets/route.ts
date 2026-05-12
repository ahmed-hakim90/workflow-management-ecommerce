import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { getOrder } from "@/lib/services/orders.service";
import { createTicket, listTickets } from "@/lib/services/tickets.service";
import type { TicketStatus, TicketType } from "@/lib/types/models";

const createSchema = z.object({
  order_id: z.string().min(1),
  type: z.enum(["return", "exchange", "complaint"]),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "ticket:read");
    const url = new URL(req.url);
    const status = url.searchParams.get("status") as TicketStatus | null;
    const orderId = url.searchParams.get("order_id");
    const includeOrderSummary = url.searchParams.get("includeOrderSummary") === "1";
    const tickets = await listTickets(ctx.tenantId, {
      status: status ?? undefined,
      orderId: orderId ?? undefined,
    });
    if (includeOrderSummary) {
      const enriched = await Promise.all(
        tickets.map(async (ticket) => {
          const order = await getOrder(ctx.tenantId, ticket.order_id);
          return {
            ...ticket,
            order: order
              ? {
                  id: order.id,
                  wooCommerceOrderId: order.wooCommerceOrderId,
                  customer: order.customer,
                }
              : null,
          };
        }),
      );
      return jsonOk(enriched);
    }
    return jsonOk(tickets);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "ticket:create");
    const json = await req.json();
    const body = createSchema.parse(json);
    const ticket = await createTicket({
      tenantId: ctx.tenantId,
      order_id: body.order_id,
      type: body.type as TicketType,
      notes: body.notes,
      actorUserId: ctx.userId,
    });
    return jsonOk(ticket);
  } catch (e) {
    return handleRouteError(e);
  }
}
