import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { listBostaZones } from "@/lib/integrations/bosta";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";

export const runtime = "nodejs";

const querySchema = z.object({
  cityId: z.string().trim().min(1, "cityId is required"),
});

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:settings");
    assertCan(ctx, "user:manage");
    const url = new URL(req.url);
    const q = querySchema.parse({
      cityId: url.searchParams.get("cityId") ?? "",
    });
    const zones = await listBostaZones(ctx.tenantId, q.cityId);
    return jsonOk(zones);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST() {
  return jsonError("Method not allowed", 405);
}
