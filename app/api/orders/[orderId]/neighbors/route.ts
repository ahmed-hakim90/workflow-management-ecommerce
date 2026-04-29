import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk, jsonError } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { getOrderNeighborsSameStatus } from "@/lib/services/orders.service";

export async function GET(
  _req: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const ctx = await requireTenant(_req);
    assertCan(ctx, "order:read");
    const { orderId } = await context.params;
    if (!orderId?.trim()) return jsonError("Missing order id", 400);
    const neighbors = await getOrderNeighborsSameStatus(ctx.tenantId, orderId);
    if (!neighbors) return jsonError("Not found", 404);
    return jsonOk(neighbors);
  } catch (e) {
    return handleRouteError(e);
  }
}
