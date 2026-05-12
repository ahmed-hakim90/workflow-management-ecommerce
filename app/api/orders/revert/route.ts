import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { revertOrderStage } from "@/lib/services/orders.service";

const bodySchema = z.object({
  orderId: z.string().min(1),
  to: z.enum(["ready_for_shipping", "awb_created", "warehouse_picking"]),
  reason: z.string().min(1).max(2000),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "order:revert");
    const json = await req.json();
    const body = bodySchema.parse(json);
    const order = await revertOrderStage({
      tenantId: ctx.tenantId,
      orderId: body.orderId,
      to: body.to,
      reason: body.reason,
      actorUserId: ctx.userId,
    });
    return jsonOk(order);
  } catch (e) {
    return handleRouteError(e);
  }
}
