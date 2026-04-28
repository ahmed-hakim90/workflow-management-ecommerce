import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { defaultTenantAutomation } from "@/lib/types/models";
import { getTenantAutomation } from "@/lib/services/tenant-settings.service";

/**
 * قالب واتساب الافتراضي لفريق التأكيد — للقراءة بأي دور يرى الطلبات.
 */
export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:settings");
    assertCan(ctx, "order:read");
    const a = await getTenantAutomation(ctx.tenantId);
    const t =
      a.whatsappMessageTemplate?.trim() ||
      defaultTenantAutomation.whatsappMessageTemplate;
    return jsonOk({
      whatsappMessageTemplate: t!,
      orderLinkTemplate: a.orderLinkTemplate?.trim() || "",
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
