import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { aggregateAnalyticsRange } from "@/lib/services/analytics-daily.service";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

function profitFromRow(row: {
  orders_value: number;
  shipping_cost: number;
  returns_value: number;
  exchanges_value: number;
}) {
  return (
    row.orders_value -
    row.shipping_cost -
    row.returns_value -
    row.exchanges_value
  );
}

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx.role, "user:read");
    if (ctx.role !== "admin" && ctx.role !== "moderator") {
      const err = new Error("Forbidden");
      (err as Error & { status: number }).status = 403;
      throw err;
    }

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

    const { totals, series } = await aggregateAnalyticsRange({
      tenantId: ctx.tenantId,
      from,
      to,
    });

    const profit = profitFromRow(totals);
    const costPerOrder =
      totals.orders_count > 0 ? totals.shipping_cost / totals.orders_count : 0;
    const returnRate =
      totals.orders_count > 0 ? totals.returns_count / totals.orders_count : 0;
    const conversionRate =
      totals.orders_count > 0
        ? totals.confirmed_orders_count / totals.orders_count
        : 0;

    const seriesOut = series.map((row) => ({
      date: row.date,
      orders_count: row.orders_count,
      orders_value: row.orders_value,
      shipping_cost: row.shipping_cost,
      returns_count: row.returns_count,
      profit: profitFromRow(row),
    }));

    return jsonOk({
      from,
      to,
      totals: {
        ...totals,
        profit,
      },
      series: seriesOut,
      kpi: {
        costPerOrder,
        returnRate,
        conversionRate,
        profit,
        exchangesValueNote:
          "exchanges_value is reserved; replacement order delta is not stored yet.",
      },
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
