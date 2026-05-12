import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { getChatConversation } from "@/lib/services/chat/conversations.service";
import { assertConversationWritable } from "@/lib/services/chat/inbox-access.service";
import { appendOutgoingOrInternalMessage } from "@/lib/services/chat/messages.service";
import { appendOrderEvent } from "@/lib/services/order-events.service";

const bodySchema = z.object({
  body: z.string().min(1).max(8000),
});

export async function POST(
  req: Request,
  routeCtx: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "inbox:write");
    const { id } = await routeCtx.params;
    const conv = await getChatConversation(ctx.tenantId, id);
    if (!conv) {
      const err = new Error("Not found") as Error & { status: number };
      err.status = 404;
      throw err;
    }
    assertConversationWritable(ctx, conv);
    const json = await req.json();
    const { body } = bodySchema.parse(json);
    const out = await appendOutgoingOrInternalMessage({
      tenantId: ctx.tenantId,
      conversationId: id,
      direction: "internal",
      type: "text",
      body,
      status: "sent",
      senderUserId: ctx.userId,
    });
    if (!out) {
      const err = new Error("Not found") as Error & { status: number };
      err.status = 404;
      throw err;
    }
    const oid = conv.linkedOrderId?.trim();
    if (oid) {
      await appendOrderEvent({
        tenantId: ctx.tenantId,
        orderId: oid,
        action: "chat.internal_note",
        userId: ctx.userId,
        metadata: {
          conversationId: id,
          messageId: out.message.id,
          preview: body.slice(0, 500),
        },
      });
    }
    return jsonOk({ message: out.message });
  } catch (e) {
    return handleRouteError(e);
  }
}
