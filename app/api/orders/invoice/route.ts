import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { invoiceOrder } from "@/lib/services/orders.service";

const bodySchema = z.object({
  orderId: z.string().min(1),
  invoiceNumber: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx.role, "order:invoice");
    const json = await req.json();
    const { orderId, invoiceNumber } = bodySchema.parse(json);
    const order = await invoiceOrder({
      tenantId: ctx.tenantId,
      orderId,
      invoiceNumber,
      actorUserId: ctx.userId,
    });
    return jsonOk(order);
  } catch (e) {
    return handleRouteError(e);
  }
}
