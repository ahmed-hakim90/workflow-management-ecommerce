import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { rebuildAnalyticsDay } from "@/lib/services/analytics-daily.service";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Recomputes `analytics_daily` for one UTC calendar day from operational collections.
 * Admin / moderator only.
 */
export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx.role, "user:read");
    if (ctx.role !== "admin" && ctx.role !== "moderator") {
      const err = new Error("Forbidden");
      (err as Error & { status: number }).status = 403;
      throw err;
    }

    const body = (await req.json().catch(() => null)) as { date?: string } | null;
    const date = body?.date ?? "";
    if (!ISO_DATE.test(date)) {
      return jsonError("Body must include date as YYYY-MM-DD", 400);
    }

    const row = await rebuildAnalyticsDay(ctx.tenantId, date);
    return jsonOk({ date, row });
  } catch (e) {
    return handleRouteError(e);
  }
}
