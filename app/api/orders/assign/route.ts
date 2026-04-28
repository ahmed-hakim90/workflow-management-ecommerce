import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { assignOrder } from "@/lib/services/orders.service";

const bodySchema = z.object({
  orderId: z.string().min(1),
  assigneeUserId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "order:assign");
    const json = await req.json();
    const { orderId, assigneeUserId } = bodySchema.parse(json);
    const order = await assignOrder({
      tenantId: ctx.tenantId,
      orderId,
      assigneeUserId: assigneeUserId ?? null,
      actorUserId: ctx.userId,
    });
    return jsonOk(order);
  } catch (e) {
    return handleRouteError(e);
  }
}
