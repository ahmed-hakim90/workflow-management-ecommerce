import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { listActivitiesForEntity } from "@/lib/services/activity.service";
import { getOrderDetailBundle } from "@/lib/services/orders.service";
import { deleteTicket, getTicket } from "@/lib/services/tickets.service";
import { listUsers } from "@/lib/services/users.service";

export async function GET(
  req: Request,
  context: { params: Promise<{ ticketId: string }> },
) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "ticket:read");
    const { ticketId } = await context.params;
    if (!ticketId?.trim()) return jsonError("Missing ticket id", 400);
    const ticket = await getTicket(ctx.tenantId, ticketId);
    if (!ticket) return jsonError("Not found", 404);
    const [orderBundle, activities, users] = await Promise.all([
      getOrderDetailBundle(ctx.tenantId, ticket.order_id),
      listActivitiesForEntity({
        tenantId: ctx.tenantId,
        entityType: "ticket",
        entityId: ticket.id,
        limit: 100,
      }),
      listUsers(ctx.tenantId),
    ]);
    return jsonOk({
      ticket,
      order: orderBundle?.order ?? null,
      shipments: orderBundle?.shipments ?? [],
      activities,
      users,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ ticketId: string }> },
) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "ticket:delete");
    if (ctx.role !== "admin") return jsonError("Forbidden", 403);
    const { ticketId } = await context.params;
    if (!ticketId?.trim()) return jsonError("Missing ticket id", 400);
    await deleteTicket({
      tenantId: ctx.tenantId,
      ticketId,
      actorUserId: ctx.userId,
    });
    return jsonOk({ deleted: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
