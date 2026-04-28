import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { getUser } from "@/lib/services/users.service";
import { getUserStatsForToday } from "@/lib/services/analytics.service";

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "user:read");
    const profile = await getUser(ctx.tenantId, ctx.userId);
    const target = profile?.daily_target ?? 0;
    const stats = await getUserStatsForToday(ctx.tenantId, ctx.userId);
    const done =
      (stats?.confirmed ?? 0) + (stats?.invoiced ?? 0) + (stats?.packed ?? 0);
    const performancePct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
    return jsonOk({ target, stats, done, performancePct });
  } catch (e) {
    return handleRouteError(e);
  }
}
