import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { getCustomerProfile } from "@/lib/services/customer-profile.service";
import { omitWooSnapshotForList } from "@/lib/services/orders.service";

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "order:read");
    const url = new URL(req.url);
    const phone = url.searchParams.get("phone")?.trim();
    if (!phone) return jsonError("Missing phone", 400);
    const profile = await getCustomerProfile({
      tenantId: ctx.tenantId,
      rawPhone: phone,
    });
    if (!profile) {
      return jsonError("Invalid phone", 400);
    }
    return jsonOk({
      ...profile,
      orders: profile.orders.map(omitWooSnapshotForList),
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
