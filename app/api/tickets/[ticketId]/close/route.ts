import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { closeTicket } from "@/lib/services/tickets.service";

export async function POST(
  req: Request,
  context: { params: Promise<{ ticketId: string }> },
) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "ticket:resolve");
    const { ticketId } = await context.params;
    if (!ticketId?.trim()) return jsonError("Missing ticket id", 400);
    const ticket = await closeTicket({
      tenantId: ctx.tenantId,
      ticketId,
      actorUserId: ctx.userId,
    });
    return jsonOk(ticket);
  } catch (e) {
    return handleRouteError(e);
  }
}
