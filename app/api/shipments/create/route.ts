import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { createShipmentForOrder } from "@/lib/services/shipments.service";
import type {
  ShipmentLabelFormat,
  ShipmentType,
  ShippingProvider,
} from "@/lib/types/models";

const bodySchema = z.object({
  orderId: z.string().min(1),
  type: z.enum(["delivery", "return", "exchange"]).optional(),
  provider: z.enum(["bosta", "jnt_egypt", "fedex"]).optional(),
  serviceCode: z.string().max(100).optional(),
  labelFormat: z.enum(["pdf", "zpl", "thermal"]).optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "shipment:create");
    const json = await req.json();
    const { orderId, type, provider, serviceCode, labelFormat } =
      bodySchema.parse(json);
    const shipment = await createShipmentForOrder({
      tenantId: ctx.tenantId,
      orderId,
      type: type as ShipmentType | undefined,
      provider: provider as ShippingProvider | undefined,
      serviceCode,
      labelFormat: labelFormat as ShipmentLabelFormat | undefined,
      actorUserId: ctx.userId,
    });
    return jsonOk(shipment);
  } catch (e) {
    return handleRouteError(e);
  }
}
