import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { aggregateCarrierFinancials } from "@/lib/services/analytics-daily.service";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "finance:view");

    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
      return jsonError("Invalid from/to (expected YYYY-MM-DD)", 400);
    }
    if (from > to) {
      return jsonError("from must be <= to", 400);
    }

    const startMs = new Date(`${from}T00:00:00.000Z`).getTime();
    const endMs = new Date(`${to}T00:00:00.000Z`).getTime();
    const days = (endMs - startMs) / 86400000 + 1;
    if (days > MAX_RANGE_DAYS) {
      return jsonError(`Range too large (max ${MAX_RANGE_DAYS} days)`, 400);
    }

    const carriers = await aggregateCarrierFinancials({
      tenantId: ctx.tenantId,
      from,
      to,
    });

    return jsonOk({ from, to, carriers });
  } catch (e) {
    return handleRouteError(e);
  }
}
