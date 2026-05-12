import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { getChatConversation } from "@/lib/services/chat/conversations.service";
import { assertConversationReadable } from "@/lib/services/chat/inbox-access.service";
import { listChatMessagesPaginated } from "@/lib/services/chat/messages.service";

export async function GET(
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

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit") ?? "40") || 40),
    );
    const { messages, nextCursor } = await listChatMessagesPaginated({
      tenantId: ctx.tenantId,
      conversationId: id,
      limit,
      cursor,
    });
    return jsonOk({ messages, nextCursor });
  } catch (e) {
    return handleRouteError(e);
  }
}
