import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { computeInboxAgentStats } from "@/lib/services/chat/inbox-agent-stats.service";
import { listUsers } from "@/lib/services/users.service";

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "inbox:read");
    const url = new URL(req.url);
    const days = Math.min(
      30,
      Math.max(1, Number(url.searchParams.get("days") ?? "7") || 7),
    );
    const [stats, users] = await Promise.all([
      computeInboxAgentStats({ tenantId: ctx.tenantId, days }),
      listUsers(ctx.tenantId),
    ]);
    const names = new Map(users.map((u) => [u.id, u.name]));
    return jsonOk({
      ...stats,
      userNames: Object.fromEntries(names),
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
