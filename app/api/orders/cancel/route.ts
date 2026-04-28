import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { cancelOrder } from "@/lib/services/orders.service";

const bodySchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(2, "Cancel reason is required"),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "order:cancel");
    const json = await req.json();
    const { orderId, reason } = bodySchema.parse(json);
    const order = await cancelOrder({
      tenantId: ctx.tenantId,
      orderId,
      actorUserId: ctx.userId,
      reason,
    });
    return jsonOk(order);
  } catch (e) {
    return handleRouteError(e);
  }
}
