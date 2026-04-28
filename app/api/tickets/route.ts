import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
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
    const tickets = await listTickets(ctx.tenantId, {
      status: status ?? undefined,
    });
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
