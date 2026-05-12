import { requireTenant } from "@/lib/auth/context";
import { assertCan, can } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { computeOrderOverdueAlerts } from "@/lib/logic/order-overdue-alerts";
import { listOrdersPage } from "@/lib/services/orders.service";
import { getOrdersPerStage } from "@/lib/services/analytics.service";
import { listUsers } from "@/lib/services/users.service";
import { getUserStatsForToday } from "@/lib/services/analytics.service";

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:admin");
    assertCan(ctx, "user:read");
    const [perStage, alertOrdersPage] = await Promise.all([
      getOrdersPerStage(ctx.tenantId),
      listOrdersPage(ctx.tenantId, {
        status: [
          "new",
          "pending_confirmation",
          "confirmed",
          "invoice_required",
          "invoiced",
          "ready_for_shipping",
          "awb_created",
          "warehouse_picking",
          "warehouse_packed",
        ],
        limit: 50,
      }),
    ]);
    const { stageValues: rawStageValues, ...stages } = perStage;
    const stageValues = can(ctx, "finance:view")
      ? rawStageValues
      : Object.fromEntries(Object.keys(rawStageValues).map((key) => [key, 0]));
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
    const overdueAlerts = computeOrderOverdueAlerts(alertOrdersPage.data).slice(0, 25);
    return jsonOk({ stages, stageValues, team, bottleneck, overdueAlerts });
  } catch (e) {
    return handleRouteError(e);
  }
}
