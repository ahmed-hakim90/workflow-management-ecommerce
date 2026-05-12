import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { updateShipment } from "@/lib/services/shipments.service";

const bodySchema = z
  .object({
    codAmount: z.number().finite().min(0).optional(),
    allowOpening: z.boolean().optional(),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (v) =>
      v.codAmount !== undefined ||
      v.allowOpening !== undefined ||
      Boolean(v.notes?.trim()),
    "At least one shipment edit is required",
  );

export async function POST(
  req: Request,
  context: { params: Promise<{ shipmentId: string }> },
) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "shipment:create");
    const { shipmentId } = await context.params;
    if (!shipmentId?.trim()) return jsonError("Missing shipment id", 400);
    const json = await req.json();
    const body = bodySchema.parse(json);
    const shipment = await updateShipment({
      tenantId: ctx.tenantId,
      shipmentId,
      actorUserId: ctx.userId,
      codAmount: body.codAmount,
      allowOpening: body.allowOpening,
      notes: body.notes,
    });
    return jsonOk(shipment);
  } catch (e) {
    return handleRouteError(e);
  }
}
