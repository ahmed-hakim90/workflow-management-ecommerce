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
import { listShipmentsForTenant } from "@/lib/services/shipments.service";

const querySchema = z.object({
  status: z.string().optional(),
  assignedTo: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "order:read");
    const url = new URL(req.url);
    const q = querySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      assignedTo: url.searchParams.get("assignedTo") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    const orders = await listOrders(ctx.tenantId, {
      status: q.status as OrderStatus | undefined,
      assignedTo: q.assignedTo,
      from: q.from,
      to: q.to,
    });
    const [integrations, whatsappSends, users, shipments] = await Promise.all([
      getTenantIntegrations(ctx.tenantId),
      listLatestOrderWhatsAppSends(
        ctx.tenantId,
        orders.map((order) => order.id),
      ),
      listUsers(ctx.tenantId),
      listShipmentsForTenant(ctx.tenantId),
    ]);
    const storeUrl = integrations.woocommerce?.storeUrl;
    const userNames = new Map(users.map((u) => [u.id, u.name]));
    const latestShipmentByOrder = new Map(
      shipments
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((shipment) => [shipment.order_id, shipment]),
    );
    return jsonOk(
      orders.map((order) => {
        const latestShipment = latestShipmentByOrder.get(order.id);
        return {
          ...order,
          wooCommerceOrderAdminUrl: buildWooCommerceOrderAdminUrl({
            storeUrl,
            wooOrderId: order.wooCommerceOrderId,
          }),
          latestShipmentAwb: latestShipment?.awb,
          latestShipmentCarrierTrackingStatus:
            latestShipment?.carrierTrackingStatus,
          latestShipmentStatus: latestShipment?.status,
          whatsappSentAt: whatsappSends[order.id]?.sentAt,
          whatsappSentByUserId: whatsappSends[order.id]?.sentByUserId,
          whatsappSentByUserName: whatsappSends[order.id]?.sentByUserId
            ? userNames.get(whatsappSends[order.id].sentByUserId)
            : undefined,
          whatsappSentPhone: whatsappSends[order.id]?.phone,
        };
      }),
    );
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST() {
  return jsonError("Method not allowed", 405);
}
