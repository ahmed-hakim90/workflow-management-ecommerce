import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockAppendWebhookIngestLog,
  mockListWebhookIngestLogs,
} from "@/lib/dev/mock-backend";
import type {
  WebhookIngestLog,
  WebhookIngestOutcome,
  WebhookIngestSource,
  WebhookIngestStatus,
} from "@/lib/types/models";

const ERR_MAX = 500;

function trimErr(msg: string | undefined): string | undefined {
  if (!msg?.trim()) return undefined;
  return msg.length > ERR_MAX ? `${msg.slice(0, ERR_MAX - 1)}…` : msg;
}

/** يوحّد عرض لوحات التحكم مع قيم `outcome` القديمة. */
export function webhookOutcomeToStatus(outcome: WebhookIngestOutcome): WebhookIngestStatus {
  if (outcome === "duplicate_200") return "duplicate";
  if (
    outcome === "order_upserted_200" ||
    outcome === "diagnostic_200"
  ) {
    return "processed";
  }
  return "failed";
}

/** يملأ الحقول الجديدة للمستندات المخزّنة قبل التوسعة. */
export function hydrateWebhookIngestLog(
  raw: Record<string, unknown>,
): WebhookIngestLog {
  const r = raw as unknown as WebhookIngestLog;
  const createdAt =
    typeof r.createdAt === "string"
      ? r.createdAt
      : new Date().toISOString();
  const deliveryId = typeof r.deliveryId === "string" ? r.deliveryId : "";
  const outcome = r.outcome as WebhookIngestOutcome | undefined;
  return {
    ...r,
    deliveryId,
    webhookId: typeof r.webhookId === "string" ? r.webhookId : deliveryId,
    status:
      r.status ??
      (outcome ? webhookOutcomeToStatus(outcome) : "failed"),
    receivedAt: typeof r.receivedAt === "string" ? r.receivedAt : createdAt,
    processedAt: typeof r.processedAt === "string" ? r.processedAt : createdAt,
    createdAt,
  };
}

/**
 * Audit row for each WooCommerce (etc.) delivery attempt.
 * Await in webhook handlers so failures are usually persisted before the HTTP response finishes.
 * Still wrapped to avoid breaking the response if the log write fails.
 */
export async function appendWebhookIngestLog(input: {
  tenantId: string;
  source: WebhookIngestSource;
  deliveryId: string;
  outcome: WebhookIngestOutcome;
  httpStatus: number;
  orderId?: string;
  wooOrderId?: string;
  externalOrderId?: string;
  errorMessage?: string;
  requestBodyBytes: number;
  /** مثل `X-WC-Webhook-Topic` — لتتبع نوع الحدث. */
  eventType?: string;
  /** بداية معالجة الطلب (يُمرَّر من الـ route). */
  receivedAt?: string;
  /** نهاية المعالجة؛ الافتراضي الآن. */
  processedAt?: string;
}): Promise<void> {
  const id = crypto.randomUUID();
  const receivedAt = input.receivedAt ?? new Date().toISOString();
  const processedAt = input.processedAt ?? new Date().toISOString();
  const status = webhookOutcomeToStatus(input.outcome);
  const row: WebhookIngestLog = {
    id,
    tenantId: input.tenantId,
    source: input.source,
    deliveryId: input.deliveryId,
    webhookId: input.deliveryId,
    eventType: input.eventType,
    outcome: input.outcome,
    status,
    httpStatus: input.httpStatus,
    orderId: input.orderId,
    wooOrderId: input.wooOrderId,
    externalOrderId: input.externalOrderId ?? input.wooOrderId,
    errorMessage: trimErr(input.errorMessage),
    requestBodyBytes: input.requestBodyBytes,
    receivedAt,
    processedAt,
    createdAt: receivedAt,
  };

  if (isDevMockDataEnabled()) {
    try {
      mockAppendWebhookIngestLog(row);
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    await getSupabaseServiceRoleClient()
      .from("webhook_ingest_logs")
      .insert({
        id,
        tenant_id: row.tenantId,
        source: row.source,
        delivery_id: row.deliveryId,
        outcome: row.outcome,
        http_status: row.httpStatus,
        message: row.errorMessage,
        metadata: row,
        created_at: row.createdAt,
      });
  } catch {
    /* ignore: do not block webhook; caller already awaited */
  }
}

export async function listRecentWebhookIngestLogs(
  tenantId: string,
  limit: number = 30,
): Promise<WebhookIngestLog[]> {
  const cap = Math.min(Math.max(limit, 1), 100);
  if (isDevMockDataEnabled()) {
    return mockListWebhookIngestLogs(tenantId, cap);
  }
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("webhook_ingest_logs")
    .select("metadata")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(cap);
  if (error) throw error;
  return (data ?? []).map((row) =>
    hydrateWebhookIngestLog((row.metadata ?? {}) as Record<string, unknown>),
  );
}
