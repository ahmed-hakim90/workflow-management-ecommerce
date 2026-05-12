import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { listTicketsByOrder } from "@/lib/services/tickets.service";

export async function GET(
  req: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "ticket:read");
    const { orderId } = await context.params;
    if (!orderId?.trim()) return jsonError("Missing order id", 400);
    const tickets = await listTicketsByOrder(ctx.tenantId, orderId);
    return jsonOk(tickets);
  } catch (e) {
    return handleRouteError(e);
  }
}
