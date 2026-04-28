import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { scanAwb } from "@/lib/services/shipments.service";

const bodySchema = z.object({
  awb: z.string().min(3),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "shipment:scan");
    const json = await req.json();
    const { awb } = bodySchema.parse(json);
    const result = await scanAwb({
      tenantId: ctx.tenantId,
      awb,
      actorUserId: ctx.userId,
    });
    return jsonOk(result);
  } catch (e) {
    return handleRouteError(e);
  }
}
