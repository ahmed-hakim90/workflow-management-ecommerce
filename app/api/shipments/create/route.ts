import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { createShipmentForOrder } from "@/lib/services/shipments.service";
import type { ShipmentType } from "@/lib/types/models";

const bodySchema = z.object({
  orderId: z.string().min(1),
  type: z.enum(["delivery", "return", "exchange"]).optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx.role, "shipment:create");
    const json = await req.json();
    const { orderId, type } = bodySchema.parse(json);
    const shipment = await createShipmentForOrder({
      tenantId: ctx.tenantId,
      orderId,
      type: type as ShipmentType | undefined,
      actorUserId: ctx.userId,
    });
    return jsonOk(shipment);
  } catch (e) {
    return handleRouteError(e);
  }
}
