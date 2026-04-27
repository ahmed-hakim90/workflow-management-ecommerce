import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk, jsonError } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { listOrders } from "@/lib/services/orders.service";
import { listLatestOrderWhatsAppSends } from "@/lib/services/order-contact.service";
import { getTenantIntegrations } from "@/lib/services/tenant-settings.service";
import { listUsers } from "@/lib/services/users.service";
import { buildWooCommerceOrderAdminUrl } from "@/lib/integrations/woocommerce-rest";
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
    const [integrations, whatsappSends, users] = await Promise.all([
      getTenantIntegrations(ctx.tenantId),
      listLatestOrderWhatsAppSends(
        ctx.tenantId,
        orders.map((order) => order.id),
      ),
      listUsers(ctx.tenantId),
    ]);
    const storeUrl = integrations.woocommerce?.storeUrl;
    const userNames = new Map(users.map((u) => [u.id, u.name]));
    return jsonOk(
      orders.map((order) => ({
        ...order,
        wooCommerceOrderAdminUrl: buildWooCommerceOrderAdminUrl({
          storeUrl,
          wooOrderId: order.wooCommerceOrderId,
        }),
        whatsappSentAt: whatsappSends[order.id]?.sentAt,
        whatsappSentByUserId: whatsappSends[order.id]?.sentByUserId,
        whatsappSentByUserName: whatsappSends[order.id]?.sentByUserId
          ? userNames.get(whatsappSends[order.id].sentByUserId)
          : undefined,
        whatsappSentPhone: whatsappSends[order.id]?.phone,
      })),
    );
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST() {
  return jsonError("Method not allowed", 405);
}
