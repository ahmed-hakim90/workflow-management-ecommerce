import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import type {
  WhatsAppWebhookLog,
  WhatsAppWebhookLogOutcome,
} from "@/lib/types/chat";

const TRUNC = 8000;

export async function appendWhatsAppWebhookLog(input: {
  tenantId: string;
  phoneNumberId?: string;
  outcome: WhatsAppWebhookLogOutcome;
  httpStatus: number;
  messageIds?: string[];
  rawBody?: string;
  errorMessage?: string;
}): Promise<void> {
  if (isDevMockDataEnabled()) return;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const doc: WhatsAppWebhookLog = {
    id,
    tenantId: input.tenantId,
    phoneNumberId: input.phoneNumberId,
    outcome: input.outcome,
    httpStatus: input.httpStatus,
    messageIds: input.messageIds,
    rawBodyTruncated: input.rawBody?.slice(0, TRUNC),
    errorMessage: input.errorMessage?.slice(0, 2000),
    createdAt: now,
  };
  const { error } = await getSupabaseServiceRoleClient()
    .from("whatsapp_webhook_logs")
    .insert({
      id,
      tenant_id: doc.tenantId,
      phone_number_id: doc.phoneNumberId,
      outcome: doc.outcome,
      http_status: doc.httpStatus,
      message_ids: doc.messageIds ?? [],
      raw_body_truncated: doc.rawBodyTruncated,
      error_message: doc.errorMessage,
      created_at: doc.createdAt,
    });
  if (error) throw error;
}
