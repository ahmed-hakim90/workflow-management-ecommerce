import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { confirmOrder } from "@/lib/services/orders.service";

const bodySchema = z.object({
  orderId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const ctx = requireTenant(req);
    assertCan(ctx.role, "order:confirm");
    const json = await req.json();
    const { orderId } = bodySchema.parse(json);
    const order = await confirmOrder({
      tenantId: ctx.tenantId,
      orderId,
      actorUserId: ctx.userId,
    });
    return jsonOk(order);
  } catch (e) {
    return handleRouteError(e);
  }
}
