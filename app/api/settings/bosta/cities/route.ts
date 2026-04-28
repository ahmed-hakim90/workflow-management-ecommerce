import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { listBostaCities } from "@/lib/integrations/bosta";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:settings");
    assertCan(ctx, "user:manage");
    const cities = await listBostaCities(ctx.tenantId);
    return jsonOk(cities);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST() {
  return jsonError("Method not allowed", 405);
}
