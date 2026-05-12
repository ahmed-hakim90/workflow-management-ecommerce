import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { listOrderEvents } from "@/lib/services/order-events.service";

export async function GET(
  req: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "order:read");
    const { orderId } = await context.params;
    if (!orderId?.trim()) return jsonError("Missing order id", 400);
    const url = new URL(req.url);
    const prefix = url.searchParams.get("prefix") ?? undefined;
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw
      ? Math.min(200, Math.max(1, Number(limitRaw) || 80))
      : 80;
    const events = await listOrderEvents({
      tenantId: ctx.tenantId,
      orderId: orderId.trim(),
      limit,
      actionPrefix: prefix ?? undefined,
    });
    return jsonOk(events);
  } catch (e) {
    return handleRouteError(e);
  }
}
