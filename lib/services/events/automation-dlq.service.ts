import crypto from "node:crypto";
import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import type { JsonValue } from "@/lib/types/models";
import type { AutomationDlqRow } from "@/lib/types/oms-events";

/**
 * بعد استنفاد إعادة الإرسال — نخزّن صفاً للمراجعة اليدوية.
 */
export async function appendAutomationDlq(input: {
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
  errorMessage: string;
  attemptCount: number;
  automationRunId?: string;
}): Promise<void> {
  if (isDevMockDataEnabled()) return;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row: AutomationDlqRow = {
    id,
    tenantId: input.tenantId,
    eventType: input.eventType,
    occurredAt: now,
    payload: input.payload as JsonValue,
    errorMessage: input.errorMessage.slice(0, 2000),
    attemptCount: input.attemptCount,
    lastAttemptAt: now,
    automationRunId: input.automationRunId,
    createdAt: now,
  };
  const { error } = await getSupabaseServiceRoleClient()
    .from("automation_dlq")
    .insert({
      id,
      tenant_id: row.tenantId,
      event_type: row.eventType,
      payload: row.payload,
      error_message: row.errorMessage,
      retry_count: row.attemptCount,
      created_at: row.createdAt,
    });
  if (error) throw error;
}
