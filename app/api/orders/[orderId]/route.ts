import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk, jsonError } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { getOrderDetailBundle } from "@/lib/services/orders.service";

export async function GET(
  _req: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const ctx = requireTenant(_req);
    assertCan(ctx.role, "order:read");
    const { orderId } = await context.params;
    if (!orderId?.trim()) return jsonError("Missing order id", 400);
    const bundle = await getOrderDetailBundle(ctx.tenantId, orderId);
    if (!bundle) return jsonError("Not found", 404);
    return jsonOk(bundle);
  } catch (e) {
    return handleRouteError(e);
  }
}
