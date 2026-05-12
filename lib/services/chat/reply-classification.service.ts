import { logActivity } from "@/lib/services/activity.service";
import { appendOrderEvent } from "@/lib/services/order-events.service";
import {
  getChatConversation,
  updateChatConversation,
} from "@/lib/services/chat/conversations.service";
import {
  getChatMessage,
  patchChatMessage,
} from "@/lib/services/chat/messages.service";
import { emitOmsEventDeferred } from "@/lib/services/events/oms-event-emitter.service";
import { getTenantAutomation } from "@/lib/services/tenant-settings.service";
import type { JsonValue } from "@/lib/types/models";
import type { ReplyIntent } from "@/lib/logic/reply-intent-classify";
import type { EscalationDepartment } from "@/lib/logic/reply-intent-classify";

export type ClassificationSource = "heuristic" | "n8n" | "llm" | "manual";

const DEFAULT_THRESHOLD = 0.8;

function asMetadata(v: JsonValue | undefined): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return { ...(v as Record<string, unknown>) };
  }
  return {};
}

/**
 * Records classifier output on the message + order timeline; optionally escalates to human.
 */
export async function recordReplyClassification(input: {
  tenantId: string;
  conversationId: string;
  messageId: string;
  orderId?: string | null;
  intent: ReplyIntent;
  confidence: number;
  source: ClassificationSource;
  rawLabel?: string;
  departmentHint?: EscalationDepartment;
  /** Escalate when confidence is strictly below this (default 0.8). */
  confidenceThreshold?: number;
  bodyPreview?: string;
  /** When false, skip human queue + needs_human n8n (e.g. n8n already handled). */
  escalateOnLowConfidence?: boolean;
  /** شرح قصير من نموذج LLM أو مسار خارجي. */
  reason?: string;
}): Promise<void> {
  const threshold = input.confidenceThreshold ?? DEFAULT_THRESHOLD;
  const escalate =
    input.escalateOnLowConfidence !== false &&
    (input.confidence < threshold ||
      input.intent === "unknown" ||
      (input.intent === "greeting" && input.confidence < 0.82));

  const msg = await getChatMessage({
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    messageId: input.messageId,
  });
  if (msg) {
    const prev = asMetadata(msg.metadata);
    const classification = {
      intent: input.intent,
      confidence: input.confidence,
      source: input.source,
      at: new Date().toISOString(),
      ...(input.rawLabel?.trim() ? { rawLabel: input.rawLabel.trim() } : {}),
      ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
      ...(input.departmentHint
        ? { departmentHint: input.departmentHint }
        : {}),
      escalated: escalate,
    };
    await patchChatMessage({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      patch: {
        metadata: {
          ...prev,
          classification,
        } as JsonValue,
      },
    });
  }

  const oid = input.orderId?.trim();
  if (oid) {
    await appendOrderEvent({
      tenantId: input.tenantId,
      orderId: oid,
      action: "chat.classified",
      userId:
        input.source === "heuristic"
          ? "system:heuristic_classifier"
          : "system:automation",
      metadata: {
        conversationId: input.conversationId,
        messageId: input.messageId,
        intent: input.intent,
        confidence: input.confidence,
        source: input.source,
        ...(input.rawLabel?.trim() ? { rawLabel: input.rawLabel.trim() } : {}),
        ...(input.departmentHint
          ? { departmentHint: input.departmentHint }
          : {}),
        escalated: escalate,
        ...(input.bodyPreview
          ? { bodyPreview: input.bodyPreview.slice(0, 500) }
          : {}),
        ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
      },
    });
  }

  const conv = await getChatConversation(input.tenantId, input.conversationId);

  if (escalate) {
    if (conv) {
      await updateChatConversation(input.tenantId, input.conversationId, {
        status: "pending",
        botEnabled: false,
      });
    }
    if (oid) {
      await logActivity({
        tenantId: input.tenantId,
        action: "conversation.needs_human",
        entityType: "order",
        entityId: oid,
        userId: "system:classifier",
        metadata: {
          conversationId: input.conversationId,
          reason: "low_confidence_or_unclear",
          intent: input.intent,
          confidence: input.confidence,
        },
      });
    }
    emitOmsEventDeferred({
      source: "system",
      event: "conversation.needs_human",
      tenantId: input.tenantId,
      orderId: oid || undefined,
      conversationId: input.conversationId,
      metadata: {
        reason: "classifier_escalation",
        intent: input.intent,
        confidence: input.confidence,
      },
    });
  }

  const auto = await getTenantAutomation(input.tenantId);
  if (auto.whatsappAutomationEnabled) {
    emitOmsEventDeferred({
      source: "system",
      event: "chat.reply.classified",
      tenantId: input.tenantId,
      orderId: oid || undefined,
      conversationId: input.conversationId,
      messageId: input.messageId,
      body: input.bodyPreview,
      humanTakeover: conv?.humanTakeover,
      botEnabled: conv?.botEnabled,
      metadata: {
        intent: input.intent,
        confidence: input.confidence,
        source: input.source,
        escalated: escalate,
        ...(input.departmentHint
          ? { departmentHint: input.departmentHint }
          : {}),
      },
    });
  }
}
