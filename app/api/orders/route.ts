import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk, jsonError } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { listOrdersPage } from "@/lib/services/orders.service";
import { getTenantIntegrations } from "@/lib/services/tenant-settings.service";
import { buildWooCommerceOrderAdminUrl } from "@/lib/integrations/woocommerce-rest";
import type { OrderStatus, PaymentStatus } from "@/lib/types/models";

const querySchema = z.object({
  status: z.string().optional(),
  payment: z.string().optional(),
  assignedTo: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  cursor: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "order:read");
    const url = new URL(req.url);
    const q = querySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      payment: url.searchParams.get("payment") ?? undefined,
      assignedTo: url.searchParams.get("assignedTo") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });
    const { data: orders, pageInfo } = await listOrdersPage(ctx.tenantId, {
      status: q.status?.split(",").filter(Boolean) as OrderStatus[] | undefined,
      payment: q.payment as PaymentStatus | undefined,
      assignedTo: q.assignedTo,
      from: q.from,
      to: q.to,
      search: q.q,
      limit: q.limit,
      cursor: q.cursor,
    });
    const integrations = await getTenantIntegrations(ctx.tenantId);
    const storeUrl = integrations.woocommerce?.storeUrl;
    return jsonOk({
      orders: orders.map((order) => ({
          ...order,
          wooCommerceOrderAdminUrl: buildWooCommerceOrderAdminUrl({
            storeUrl,
            wooOrderId: order.wooCommerceOrderId,
          }),
        })),
      pageInfo,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST() {
  return jsonError("Method not allowed", 405);
}
