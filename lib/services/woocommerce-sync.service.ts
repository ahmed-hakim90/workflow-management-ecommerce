import type { Order } from "@/lib/types/models";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import { updateWooCommerceOrderStatus } from "@/lib/integrations/woocommerce-rest";
import { getTenantIntegrations } from "@/lib/services/tenant-settings.service";
import { logActivity } from "@/lib/services/activity.service";

function resolveWooRestCredentials(integrations: {
  storeUrl?: string;
  consumerKey?: string;
  consumerSecret?: string;
}) {
  const storeUrl = integrations.storeUrl?.trim() ?? "";
  const consumerKey = integrations.consumerKey?.trim() ?? "";
  const consumerSecret = integrations.consumerSecret?.trim() ?? "";
  if (!storeUrl || !consumerKey || !consumerSecret) return null;
  return { storeUrl, consumerKey, consumerSecret };
}

/**
 * Pushes current OMS order status to WooCommerce when REST credentials and woo id exist.
 * Safe to fire-and-forget; logs activity on failure.
 */
export function enqueueSyncOrderStatusToWooCommerce(input: {
  tenantId: string;
  order: Order;
  actorUserId?: string;
}): void {
  if (isDevMockDataEnabled()) return;
  const { tenantId, order } = input;
  const actorUserId = input.actorUserId ?? "system:woocommerce";

  void (async () => {
    try {
      const wooId = order.wooCommerceOrderId?.trim();
      if (!wooId) return;

      const integrations = await getTenantIntegrations(tenantId);
      const creds = resolveWooRestCredentials(integrations.woocommerce ?? {});
      if (!creds) return;

      await updateWooCommerceOrderStatus({
        credentials: creds,
        wooOrderId: wooId,
        order,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await logActivity({
        tenantId,
        action: "integration.woocommerce.status_sync_failed",
        entityType: "order",
        entityId: order.id,
        userId: actorUserId,
        metadata: { error: message, wooOrderId: order.wooCommerceOrderId },
      });
    }
  })();
}
