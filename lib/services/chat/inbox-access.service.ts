import type { RequestContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/rbac";
import type { ChatConversation } from "@/lib/types/chat";

function forbidden() {
  const e = new Error("Forbidden") as Error & { status: number };
  e.status = 403;
  return e;
}

/**
 * صلاحيات الوصول للمحادثة: أدوار مختلفة (دعم، تأكيد، مخزن) لها قواعد مختلفة.
 */
export function assertConversationReadable(
  ctx: RequestContext,
  conv: ChatConversation,
): void {
  if (can(ctx, "inbox:manage")) return;
  if (can(ctx, "inbox:read_linked_order")) {
    if (!conv.linkedOrderId?.trim()) throw forbidden();
    return;
  }
  if (!can(ctx, "inbox:read")) throw forbidden();
  if (ctx.role === "confirmation" && !conv.linkedOrderId?.trim()) {
    throw forbidden();
  }
  if (ctx.role === "support") {
    const assigned = conv.assignedUserId?.trim();
    if (assigned && assigned !== ctx.userId) {
      throw forbidden();
    }
  }
}

export function assertConversationWritable(
  ctx: RequestContext,
  conv: ChatConversation,
): void {
  if (can(ctx, "inbox:manage")) return;
  if (!can(ctx, "inbox:write")) throw forbidden();
  assertConversationReadable(ctx, conv);
  if (ctx.role === "support") {
    const assigned = conv.assignedUserId?.trim();
    if (assigned && assigned !== ctx.userId) {
      throw forbidden();
    }
  }
}
