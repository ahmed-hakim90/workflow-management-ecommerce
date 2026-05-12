import type { N8nOmsEventType } from "@/lib/types/chat";
import type { JsonValue } from "@/lib/types/models";

/** Who produced the row in `oms_events` (audit / analytics). */
export type OmsEventSource = "api" | "webhook" | "worker" | "cron" | "system";

/** Canonical event names — aligned with n8n and `N8nOmsEventType`. */
export type OmsEventType = N8nOmsEventType;

/** Append-only operational event for analytics, replay, and n8n correlation. */
export interface OmsEventRow {
  id: string;
  tenantId: string;
  eventType: string;
  occurredAt: string;
  payload: JsonValue;
  source: OmsEventSource;
  /** Stable id for tracing across webhooks, n8n, and workers (also inside payload.metadata). */
  correlationId?: string;
  /** Set when n8n delivery is tracked separately. */
  deliveryStatus?: "pending" | "delivered" | "failed";
  /** عدد محاولات التسليم إلى n8n بعد المحاولة الأولى. */
  retryCount?: number;
  /** آخر رسالة خطأ قصيرة من HTTP أو الشبكة. */
  lastDeliveryError?: string;
  createdAt: string;
}

/** Failed automation delivery after retries (DLQ). */
export interface AutomationDlqRow {
  id: string;
  tenantId: string;
  eventType: string;
  occurredAt: string;
  payload: JsonValue;
  errorMessage: string;
  attemptCount: number;
  lastAttemptAt: string;
  automationRunId?: string;
  createdAt: string;
}
