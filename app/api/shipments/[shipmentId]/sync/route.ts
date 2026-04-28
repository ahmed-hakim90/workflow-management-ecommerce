import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { syncShipmentTracking } from "@/lib/services/shipments.service";

export async function POST(
  req: Request,
  context: { params: Promise<{ shipmentId: string }> },
) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "shipment:read");
    const { shipmentId } = await context.params;
    if (!shipmentId?.trim()) return jsonError("Missing shipment id", 400);
    const shipment = await syncShipmentTracking({
      tenantId: ctx.tenantId,
      shipmentId,
      actorUserId: ctx.userId,
    });
    return jsonOk(shipment);
  } catch (e) {
    return handleRouteError(e);
  }
}
