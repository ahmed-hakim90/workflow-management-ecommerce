import crypto from "node:crypto";
import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import { sendToN8n, type N8nEventPayload } from "@/lib/services/chat/n8n-automation.service";
import type { OmsEventSource } from "@/lib/types/oms-events";
import type { OmsEventRow } from "@/lib/types/oms-events";

export type EmitOmsEventInput = N8nEventPayload & {
  source: OmsEventSource;
  correlationId?: string;
  /** When true, only persist `oms_events` (no HTTP to n8n). */
  skipN8n?: boolean;
};

/**
 * يسجّل الحدث في Supabase ثم يُرسل غلافاً موحّداً إلى n8n (مع occurredAt).
 * مصدر الحقيقة للتدقيق والتحليلات لاحقاً.
 */
export async function emitOmsEvent(input: EmitOmsEventInput): Promise<{
  omsEventId: string;
}> {
  const { source, correlationId: inputCorrelationId, skipN8n, ...rest } = input;
  const occurredAt = new Date().toISOString();
  const id = crypto.randomUUID();
  const correlationId = inputCorrelationId?.trim() || crypto.randomUUID();
  const prevMeta =
    rest.metadata && typeof rest.metadata === "object" && !Array.isArray(rest.metadata)
      ? (rest.metadata as Record<string, unknown>)
      : {};
  const n8nPayload: N8nEventPayload = {
    ...rest,
    occurredAt,
    correlationId,
    metadata: { ...prevMeta, correlationId },
  };

  const row: OmsEventRow = {
    id,
    tenantId: n8nPayload.tenantId,
    eventType: n8nPayload.event,
    occurredAt,
    payload: n8nPayload as unknown as OmsEventRow["payload"],
    source,
    correlationId,
    deliveryStatus: skipN8n ? "delivered" : "pending",
    retryCount: 0,
    createdAt: occurredAt,
  };

  if (!isDevMockDataEnabled()) {
    const aggregateType = n8nPayload.conversationId
      ? "conversation"
      : n8nPayload.orderId
        ? "order"
        : null;
    const aggregateId = n8nPayload.conversationId ?? n8nPayload.orderId ?? null;
    const { error } = await getSupabaseServiceRoleClient()
      .from("oms_events")
      .insert({
        id,
        tenant_id: row.tenantId,
        event_type: row.eventType,
        aggregate_type: aggregateType,
        aggregate_id: aggregateId,
        payload: row,
        correlation_id: row.correlationId,
        occurred_at: row.occurredAt,
        created_at: row.createdAt,
      });
    if (error) throw error;
  }

  if (!skipN8n) {
    await sendToN8n(n8nPayload, { omsEventId: id });
  }

  return { omsEventId: id };
}

/**
 * نسخة غير معطلة للمسارات الساخنة (لا تنتظر n8n).
 */
export function emitOmsEventDeferred(input: EmitOmsEventInput): void {
  void emitOmsEvent(input).catch((e) => {
    console.error("[emitOmsEvent]", input.event, e);
  });
}
