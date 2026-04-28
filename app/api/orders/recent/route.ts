import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { listRecentOrders } from "@/lib/services/orders.service";

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "order:read");

    const url = new URL(req.url);
    const requestedLimit = Number(url.searchParams.get("limit") ?? 10);
    const orders = await listRecentOrders(ctx.tenantId, requestedLimit);

    return jsonOk(orders);
  } catch (e) {
    return handleRouteError(e);
  }
}
