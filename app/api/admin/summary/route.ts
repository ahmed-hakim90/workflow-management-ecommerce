import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { getOrdersPerStage } from "@/lib/services/analytics.service";
import { listUsers } from "@/lib/services/users.service";
import { getUserStatsForToday } from "@/lib/services/analytics.service";

export async function GET(req: Request) {
  try {
    const ctx = requireTenant(req);
    assertCan(ctx.role, "user:read");
    if (ctx.role !== "admin" && ctx.role !== "moderator") {
      const err = new Error("Forbidden");
      (err as Error & { status: number }).status = 403;
      throw err;
    }
    const stages = await getOrdersPerStage(ctx.tenantId);
    const users = await listUsers(ctx.tenantId);
    const team = await Promise.all(
      users.map(async (u) => {
        const s = await getUserStatsForToday(ctx.tenantId, u.id);
        const done =
          (s?.confirmed ?? 0) + (s?.invoiced ?? 0) + (s?.packed ?? 0);
        const target = u.daily_target ?? 0;
        const performancePct =
          target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
        return {
          userId: u.id,
          name: u.name,
          role: u.role,
          target,
          done,
          performancePct,
        };
      }),
    );
    const bottleneck = Object.entries(stages)
      .filter(([k]) => k !== "warehouse")
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    return jsonOk({ stages, team, bottleneck });
  } catch (e) {
    return handleRouteError(e);
  }
}
