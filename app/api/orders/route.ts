import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk, jsonError } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { listOrders } from "@/lib/services/orders.service";
import type { OrderStatus } from "@/lib/types/models";

const querySchema = z.object({
  status: z.string().optional(),
  assignedTo: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx.role, "order:read");
    const url = new URL(req.url);
    const q = querySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      assignedTo: url.searchParams.get("assignedTo") ?? undefined,
    });
    const orders = await listOrders(ctx.tenantId, {
      status: q.status as OrderStatus | undefined,
      assignedTo: q.assignedTo,
    });
    return jsonOk(orders);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST() {
  return jsonError("Method not allowed", 405);
}
