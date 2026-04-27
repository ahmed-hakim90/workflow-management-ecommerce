import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk, jsonError } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { buildWooCommerceOrderAdminUrl } from "@/lib/integrations/woocommerce-rest";
import { listLatestOrderWhatsAppSends } from "@/lib/services/order-contact.service";
import { deleteOrder, getOrderDetailBundle } from "@/lib/services/orders.service";
import { getTenantIntegrations } from "@/lib/services/tenant-settings.service";
import { listUsers } from "@/lib/services/users.service";

export async function GET(
  _req: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const ctx = await requireTenant(_req);
    assertCan(ctx.role, "order:read");
    const { orderId } = await context.params;
    if (!orderId?.trim()) return jsonError("Missing order id", 400);
    const bundle = await getOrderDetailBundle(ctx.tenantId, orderId);
    if (!bundle) return jsonError("Not found", 404);
    const [integrations, whatsappSends, users] = await Promise.all([
      getTenantIntegrations(ctx.tenantId),
      listLatestOrderWhatsAppSends(ctx.tenantId, [bundle.order.id]),
      listUsers(ctx.tenantId),
    ]);
    const whatsapp = whatsappSends[bundle.order.id];
    const userNames = new Map(users.map((u) => [u.id, u.name]));
    return jsonOk({
      ...bundle,
      order: {
        ...bundle.order,
        wooCommerceOrderAdminUrl: buildWooCommerceOrderAdminUrl({
          storeUrl: integrations.woocommerce?.storeUrl,
          wooOrderId: bundle.order.wooCommerceOrderId,
        }),
        whatsappSentAt: whatsapp?.sentAt,
        whatsappSentByUserId: whatsapp?.sentByUserId,
        whatsappSentByUserName: whatsapp?.sentByUserId
          ? userNames.get(whatsapp.sentByUserId)
          : undefined,
        whatsappSentPhone: whatsapp?.phone,
      },
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx.role, "order:delete");
    const { orderId } = await context.params;
    if (!orderId?.trim()) return jsonError("Missing order id", 400);
    const result = await deleteOrder({
      tenantId: ctx.tenantId,
      orderId,
      actorUserId: ctx.userId,
    });
    return jsonOk(result);
  } catch (e) {
    return handleRouteError(e);
  }
}
