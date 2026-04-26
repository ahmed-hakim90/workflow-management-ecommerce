import { requireTenant } from "@/lib/auth/context";
import { jsonOk, jsonError } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { getTenant } from "@/lib/services/tenants.service";
import { getUser } from "@/lib/services/users.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    const [user, tenant] = await Promise.all([
      getUser(ctx.tenantId, ctx.userId),
      getTenant(ctx.tenantId),
    ]);
    if (!user) return jsonError("User not found", 404);
    return jsonOk({
      user: {
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        email: user.email,
        role: user.role,
        daily_target: user.daily_target,
      },
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
          }
        : null,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
