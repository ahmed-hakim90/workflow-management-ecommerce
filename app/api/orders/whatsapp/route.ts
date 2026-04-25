import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { logOrderWhatsAppSent } from "@/lib/services/order-contact.service";

const bodySchema = z.object({
  orderId: z.string().min(1),
  phone: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = requireTenant(req);
    assertCan(ctx.role, "order:confirm");
    const json = await req.json();
    const { orderId, phone } = bodySchema.parse(json);
    await logOrderWhatsAppSent({
      tenantId: ctx.tenantId,
      orderId,
      actorUserId: ctx.userId,
      phone,
    });
    return jsonOk({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
