import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { assignTicket } from "@/lib/services/tickets.service";

const bodySchema = z.object({
  ticketId: z.string().min(1),
  assigneeUserId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "ticket:assign");
    const json = await req.json();
    const { ticketId, assigneeUserId } = bodySchema.parse(json);
    const ticket = await assignTicket({
      tenantId: ctx.tenantId,
      ticketId,
      assigneeUserId: assigneeUserId ?? null,
      actorUserId: ctx.userId,
    });
    return jsonOk(ticket);
  } catch (e) {
    return handleRouteError(e);
  }
}
