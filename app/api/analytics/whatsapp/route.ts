import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { getWhatsAppOpsAnalytics } from "@/lib/services/ops-analytics.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:analytics");
    const url = new URL(req.url);
    const days = Number(url.searchParams.get("days") ?? "7");
    const data = await getWhatsAppOpsAnalytics({
      tenantId: ctx.tenantId,
      days: Number.isFinite(days) ? days : 7,
    });
    return jsonOk(data);
  } catch (e) {
    return handleRouteError(e);
  }
}
