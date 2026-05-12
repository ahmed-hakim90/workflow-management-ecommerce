import crypto from "node:crypto";
import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { getServerEnv } from "@/lib/config/env";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import { getTenantAutomation } from "@/lib/services/tenant-settings.service";
import { appendAutomationDlq } from "@/lib/services/events/automation-dlq.service";
import {
  isQStashQueueEnabled,
  publishN8nRedeliverJob,
} from "@/lib/services/queue/qstash-queue.service";
import type { N8nOmsEventType } from "@/lib/types/chat";

export type N8nEventPayload = {
  event: N8nOmsEventType;
  tenantId: string;
  /** UTC ISO — يُضاف تلقائياً عبر emitOmsEvent؛ يمكن تمريره يدوياً لنداءات legacy. */
  occurredAt?: string;
  /** يُملأ تلقائياً في emitOmsEvent ويُنسخ إلى metadata.correlationId */
  correlationId?: string;
  conversationId?: string;
  orderId?: string;
  messageId?: string;
  body?: string;
  /** يمرّر للـ n8n ليتوقف عن الرد الآلي عند تدخل موظف. */
  humanTakeover?: boolean;
  botEnabled?: boolean;
  metadata?: Record<string, unknown>;
};

function signBody(secret: string, raw: string): string {
  return crypto.createHmac("sha256", secret).update(raw).digest("hex");
}

export async function recordAutomationRun(input: {
  tenantId: string;
  eventType: string;
  status: "started" | "success" | "failed" | "dead_lettered";
  payloadSummary?: Record<string, unknown>;
  errorMessage?: string;
  omsEventId?: string;
}): Promise<string | undefined> {
  if (isDevMockDataEnabled()) return undefined;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: input.tenantId,
    eventType: input.eventType,
    status: input.status,
    payloadSummary: {
      ...(input.payloadSummary ?? {}),
      ...(input.omsEventId ? { omsEventId: input.omsEventId } : {}),
    },
    errorMessage: input.errorMessage,
    createdAt: now,
  };
  const { error } = await getSupabaseServiceRoleClient()
    .from("automation_runs")
    .insert({
      id,
      tenant_id: row.tenantId,
      event_type: row.eventType,
      status: row.status,
      payload_summary: row.payloadSummary,
      error_message: row.errorMessage,
      created_at: row.createdAt,
    });
  if (error) throw error;
  return id;
}

async function patchOmsEventDelivered(input: { omsEventId: string }): Promise<void> {
  if (isDevMockDataEnabled()) return;
  const { error } = await getSupabaseServiceRoleClient()
    .from("oms_events")
    .update({
      payload: { deliveryStatus: "delivered" },
    })
    .eq("id", input.omsEventId);
  if (error) throw error;
}

export async function patchOmsEventFailed(input: {
  omsEventId: string;
  lastError: string;
}): Promise<void> {
  if (isDevMockDataEnabled()) return;
  const { error } = await getSupabaseServiceRoleClient()
    .from("oms_events")
    .update({
      payload: {
        deliveryStatus: "failed",
        lastDeliveryError: input.lastError.slice(0, 2000),
      },
    })
    .eq("id", input.omsEventId);
  if (error) throw error;
}

/** يُسجّل محاولة فاشلة (يزيد retryCount) مع إبقاء التسليم pending حتى نفاد إعادة QStash. */
export async function recordOmsEventDeliveryFailureAttempt(input: {
  omsEventId: string;
  lastError: string;
}): Promise<void> {
  if (isDevMockDataEnabled()) return;
  const { error } = await getSupabaseServiceRoleClient()
    .from("oms_events")
    .update({
      payload: {
        lastDeliveryError: input.lastError.slice(0, 2000),
      },
    })
    .eq("id", input.omsEventId);
  if (error) throw error;
}

/**
 * يرسل حدثاً إلى n8n مع توقيع HMAC — لا يُعرض السر في الواجهة.
 * `options.omsEventId` يحدّث حقل التسليم في `oms_events` بعد النتيجة.
 */
export type SendToN8nResult =
  | { status: "success" }
  | { status: "failed" }
  | { status: "queued_retry" };

export async function sendToN8n(
  payload: N8nEventPayload,
  options?: {
    omsEventId?: string;
    allowEnqueueRetry?: boolean;
    /** عند العامل: false لتفادي تكرار DLQ قبل استنفاد إعادة QStash. */
    writeDlqOnFailure?: boolean;
  },
): Promise<SendToN8nResult> {
  const omsEventId = options?.omsEventId;
  const allowEnqueueRetry =
    options?.allowEnqueueRetry !== false && !!omsEventId;
  const writeDlqOnFailure = options?.writeDlqOnFailure !== false;
  const markOmsFailed = writeDlqOnFailure;
  const automation = await getTenantAutomation(payload.tenantId);
  const envelope: N8nEventPayload = {
    ...payload,
    occurredAt:
      payload.occurredAt?.trim() || new Date().toISOString(),
  };
  const url =
    automation.n8nWebhookUrl?.trim() ||
    getServerEnv().N8N_DEFAULT_WEBHOOK_URL?.trim() ||
    "";
  if (!url) {
    await recordAutomationRun({
      tenantId: payload.tenantId,
      eventType: payload.event,
      status: "failed",
      payloadSummary: { reason: "no_webhook_url" },
      omsEventId,
    });
    if (omsEventId && markOmsFailed) {
      await patchOmsEventFailed({
        omsEventId,
        lastError: "no_webhook_url",
      });
    }
    return { status: "failed" };
  }
  const secret =
    automation.n8nWebhookSecret?.trim() ||
    getServerEnv().N8N_HMAC_SECRET?.trim() ||
    "";
  const raw = JSON.stringify(envelope);
  await recordAutomationRun({
    tenantId: payload.tenantId,
    eventType: payload.event,
    status: "started",
    payloadSummary: {
      conversationId: payload.conversationId,
      orderId: payload.orderId,
    },
    omsEventId,
  });
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (secret) {
      headers["X-OMS-Signature"] = signBody(secret, raw);
    }
    const res = await fetch(url, { method: "POST", headers, body: raw });
    if (!res.ok) {
      const t = await res.text();
      const errMsg = `http_${res.status}:${t.slice(0, 500)}`;
      await recordAutomationRun({
        tenantId: payload.tenantId,
        eventType: payload.event,
        status: "failed",
        errorMessage: errMsg,
        omsEventId,
      });
      if (omsEventId) {
        await recordOmsEventDeliveryFailureAttempt({ omsEventId, lastError: errMsg });
      }
      if (allowEnqueueRetry && isQStashQueueEnabled()) {
        await publishN8nRedeliverJob({
          payload: envelope as unknown as Record<string, unknown>,
          omsEventId,
        });
        return { status: "queued_retry" };
      }
      if (omsEventId && markOmsFailed) {
        await patchOmsEventFailed({ omsEventId, lastError: errMsg });
      }
      if (writeDlqOnFailure) {
        await appendAutomationDlq({
          tenantId: payload.tenantId,
          eventType: payload.event,
          payload: envelope as unknown as Record<string, unknown>,
          errorMessage: errMsg,
          attemptCount: 1,
        }).catch(() => {});
      }
      return { status: "failed" };
    }
    await recordAutomationRun({
      tenantId: payload.tenantId,
      eventType: payload.event,
      status: "success",
      omsEventId,
    });
    if (omsEventId) await patchOmsEventDelivered({ omsEventId });
    return { status: "success" };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "fetch_failed";
    await recordAutomationRun({
      tenantId: payload.tenantId,
      eventType: payload.event,
      status: "failed",
      errorMessage: errMsg,
      omsEventId,
    });
    if (omsEventId) {
      await recordOmsEventDeliveryFailureAttempt({ omsEventId, lastError: errMsg });
    }
    if (allowEnqueueRetry && isQStashQueueEnabled()) {
      await publishN8nRedeliverJob({
        payload: envelope as unknown as Record<string, unknown>,
        omsEventId,
      });
      return { status: "queued_retry" };
    }
    if (omsEventId && markOmsFailed) {
      await patchOmsEventFailed({ omsEventId, lastError: errMsg });
    }
    if (writeDlqOnFailure) {
      await appendAutomationDlq({
        tenantId: payload.tenantId,
        eventType: payload.event,
        payload: envelope as unknown as Record<string, unknown>,
        errorMessage: errMsg,
        attemptCount: 1,
      }).catch(() => {});
    }
    return { status: "failed" };
  }
}
