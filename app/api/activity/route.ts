import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { listActivitiesForEntity } from "@/lib/services/activity.service";
import type { ActivityEntityType } from "@/lib/types/models";

const querySchema = z.object({
  entityType: z.enum(["order", "shipment", "ticket", "user"]),
  entityId: z.string().min(1),
  limit: z.coerce.number().min(1).max(500).optional(),
});

function assertEntityAccess(role: Parameters<typeof assertCan>[0], t: ActivityEntityType) {
  if (t === "order") assertCan(role, "order:read");
  else if (t === "shipment") assertCan(role, "shipment:read");
  else if (t === "ticket") assertCan(role, "ticket:read");
  else assertCan(role, "user:read");
}

export async function GET(req: Request) {
  try {
    const ctx = requireTenant(req);
    const url = new URL(req.url);
    const q = querySchema.parse({
      entityType: url.searchParams.get("entityType") ?? undefined,
      entityId: url.searchParams.get("entityId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    assertEntityAccess(ctx.role, q.entityType);
    const rows = await listActivitiesForEntity({
      tenantId: ctx.tenantId,
      entityType: q.entityType,
      entityId: q.entityId,
      limit: q.limit,
    });
    return jsonOk(rows);
  } catch (e) {
    return handleRouteError(e);
  }
}
