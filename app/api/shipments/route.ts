import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { listShipmentsForTenant } from "@/lib/services/shipments.service";

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx.role, "shipment:read");
    const shipments = await listShipmentsForTenant(ctx.tenantId);
    shipments.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return jsonOk(shipments);
  } catch (e) {
    return handleRouteError(e);
  }
}
