import { requireTenant } from "@/lib/auth/context";
import { assertCan, can } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import {
  getChatConversation,
  updateChatConversation,
} from "@/lib/services/chat/conversations.service";
import { assertConversationReadable } from "@/lib/services/chat/inbox-access.service";
import { getOrder } from "@/lib/services/orders.service";
import { getUser } from "@/lib/services/users.service";
import { getTenantAutomation } from "@/lib/services/tenant-settings.service";
import { appendOrderEvent } from "@/lib/services/order-events.service";
import {
  emitConversationEscalated,
  emitConversationFollowupScheduled,
  emitConversationTransferred,
} from "@/lib/services/chat/conversation-lifecycle.service";
import { emitOmsEventDeferred } from "@/lib/services/events/oms-event-emitter.service";
import type { ChatConversationStatus } from "@/lib/types/chat";
import { z } from "zod";

const patchSchema = z.object({
  assignedUserId: z.union([z.string().min(1), z.null()]).optional(),
  takeOver: z.boolean().optional(),
  releaseToBot: z.boolean().optional(),
  status: z
    .enum([
      "open",
      "pending",
      "bot_active",
      "human_takeover",
      "closed",
      "awaiting_customer_reply",
      "awaiting_internal_action",
      "pending_followup",
    ])
    .optional(),
  linkedOrderId: z.string().min(1).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(25).optional(),
  department: z.union([z.string().trim().min(1).max(60), z.null()]).optional(),
  automationPausedReason: z
    .union([z.string().trim().min(1).max(200), z.null()])
    .optional(),
  escalate: z
    .object({
      department: z.string().trim().min(1).max(60),
      reason: z.string().trim().max(500).optional(),
    })
    .optional(),
  scheduleFollowup: z.boolean().optional(),
  followupNote: z.string().trim().max(500).optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const rctx = await requireTenant(req);
    assertCan(rctx, "inbox:read");
    const { id } = await ctx.params;
    const conv = await getChatConversation(rctx.tenantId, id);
    if (!conv) {
      const err = new Error("Not found") as Error & { status: number };
      err.status = 404;
      throw err;
    }
    assertConversationReadable(rctx, conv);

    let order = null;
    if (conv.linkedOrderId?.trim()) {
      order = await getOrder(rctx.tenantId, conv.linkedOrderId);
    }

    let assignedUserName = conv.assignedUserName;
    if (conv.assignedUserId) {
      const u = await getUser(rctx.tenantId, conv.assignedUserId);
      if (u) assignedUserName = u.name;
    }

    return jsonOk({
      conversation: { ...conv, assignedUserName },
      order: order
        ? {
            id: order.id,
            status: order.status,
            customer: order.customer,
            payment: order.payment,
            wooCommerceOrderId: order.wooCommerceOrderId,
          }
        : null,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(
  req: Request,
  routeCtx: { params: Promise<{ id: string }> },
) {
  try {
    const rctx = await requireTenant(req);
    assertCan(rctx, "inbox:write");
    const { id } = await routeCtx.params;
    const conv = await getChatConversation(rctx.tenantId, id);
    if (!conv) {
      const err = new Error("Not found") as Error & { status: number };
      err.status = 404;
      throw err;
    }
    assertConversationReadable(rctx, conv);

    const json = await req.json();
    const body = patchSchema.parse(json);

    if (body.assignedUserId !== undefined) {
      const assignTo = body.assignedUserId;
      if (assignTo && assignTo !== rctx.userId && !can(rctx, "inbox:manage")) {
        const err = new Error("Forbidden") as Error & { status: number };
        err.status = 403;
        throw err;
      }
      const prevAssign = conv.assignedUserId ?? null;
      let name: string | null = null;
      if (assignTo) {
        const u = await getUser(rctx.tenantId, assignTo);
        name = u?.name ?? null;
      }
      await updateChatConversation(rctx.tenantId, id, {
        assignedUserId: assignTo,
        assignedUserName: name,
      });
      const nextAssign = assignTo ?? null;
      if (nextAssign !== prevAssign) {
        const oid = conv.linkedOrderId?.trim();
        if (oid) {
          await appendOrderEvent({
            tenantId: rctx.tenantId,
            orderId: oid,
            action: "chat.conversation_assigned",
            userId: rctx.userId,
            metadata: {
              conversationId: id,
              assignedUserId: nextAssign,
              previousAssignedUserId: prevAssign,
            },
          });
        }
        const automation = await getTenantAutomation(rctx.tenantId);
        emitOmsEventDeferred({
          source: "api",
          event: "conversation.assigned",
          tenantId: rctx.tenantId,
          conversationId: id,
          orderId: oid || undefined,
          skipN8n: !automation.whatsappAutomationEnabled,
          metadata: {
            assignedUserId: nextAssign,
            assignedUserName: name,
            previousAssignedUserId: prevAssign,
            actorUserId: rctx.userId,
          },
        });
        if (prevAssign != null && nextAssign !== prevAssign) {
          await emitConversationTransferred({
            tenantId: rctx.tenantId,
            conversationId: id,
            orderId: oid || undefined,
            fromUserId: prevAssign,
            toUserId: nextAssign,
            toUserName: name,
            actorUserId: rctx.userId,
          });
        }
      }
    }

    if (body.takeOver) {
      await updateChatConversation(rctx.tenantId, id, {
        humanTakeover: true,
        botEnabled: false,
        status: "human_takeover",
      });
      const oid = conv.linkedOrderId?.trim();
      if (oid) {
        await appendOrderEvent({
          tenantId: rctx.tenantId,
          orderId: oid,
          action: "chat.human_takeover",
          userId: rctx.userId,
          metadata: { conversationId: id },
        });
      }
    }

    if (body.releaseToBot) {
      await updateChatConversation(rctx.tenantId, id, {
        humanTakeover: false,
        botEnabled: true,
        status: "bot_active",
      });
      const oid = conv.linkedOrderId?.trim();
      if (oid) {
        await appendOrderEvent({
          tenantId: rctx.tenantId,
          orderId: oid,
          action: "chat.released_to_bot",
          userId: rctx.userId,
          metadata: { conversationId: id },
        });
      }
    }

    if (body.status) {
      await updateChatConversation(rctx.tenantId, id, {
        status: body.status as ChatConversationStatus,
      });
    }

    if (body.linkedOrderId !== undefined) {
      if (!can(rctx, "inbox:manage")) {
        const err = new Error("Forbidden") as Error & { status: number };
        err.status = 403;
        throw err;
      }
      await updateChatConversation(rctx.tenantId, id, {
        linkedOrderId: body.linkedOrderId ?? "",
      });
    }

    if (body.department !== undefined) {
      await updateChatConversation(rctx.tenantId, id, {
        department: body.department,
      });
    }

    if (body.tags !== undefined) {
      const seen = new Set<string>();
      const tags = body.tags.filter((t) => {
        const k = t.trim().toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      await updateChatConversation(rctx.tenantId, id, { tags });
    }

    if (body.automationPausedReason !== undefined) {
      await updateChatConversation(rctx.tenantId, id, {
        automationPausedReason: body.automationPausedReason,
      });
    }

    if (body.escalate) {
      await updateChatConversation(rctx.tenantId, id, {
        department: body.escalate.department,
        status: "awaiting_internal_action",
        botEnabled: false,
      });
      const oid = conv.linkedOrderId?.trim();
      await emitConversationEscalated({
        tenantId: rctx.tenantId,
        conversationId: id,
        orderId: oid || undefined,
        department: body.escalate.department,
        reason: body.escalate.reason,
        actorUserId: rctx.userId,
      });
    }

    if (body.scheduleFollowup) {
      await updateChatConversation(rctx.tenantId, id, {
        status: "pending_followup",
      });
      const oid = conv.linkedOrderId?.trim();
      await emitConversationFollowupScheduled({
        tenantId: rctx.tenantId,
        conversationId: id,
        orderId: oid || undefined,
        actorUserId: rctx.userId,
        note: body.followupNote,
      });
    }

    const next = await getChatConversation(rctx.tenantId, id);
    return jsonOk({ conversation: next });
  } catch (e) {
    return handleRouteError(e);
  }
}
