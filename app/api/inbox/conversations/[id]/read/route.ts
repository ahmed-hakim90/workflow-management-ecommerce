import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { getChatConversation } from "@/lib/services/chat/conversations.service";
import { assertConversationReadable } from "@/lib/services/chat/inbox-access.service";
import { markConversationRead } from "@/lib/services/chat/messages.service";

export async function POST(
  req: Request,
  routeCtx: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "inbox:read");
    const { id } = await routeCtx.params;
    const conv = await getChatConversation(ctx.tenantId, id);
    if (!conv) {
      const err = new Error("Not found") as Error & { status: number };
      err.status = 404;
      throw err;
    }
    assertConversationReadable(ctx, conv);
    await markConversationRead(ctx.tenantId, id);
    return jsonOk({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
