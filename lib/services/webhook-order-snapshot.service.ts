import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { cloneJsonForPersistence } from "@/lib/util/json-snapshot";

/** اسم المجموعة الفرعية تحت `orders/{orderId}` — فصل الحمولة الخام عن المستند الرئيسي. */
export const ORDER_WEBHOOK_SNAPSHOTS_SUBCOLLECTION = "webhook_snapshots";

/**
 * يخزّن جسم الويب هوك خاماً عند تفعيل البيئة — للتصحيح فقط.
 * يعيد مرجعاً نسبياً يُحفظ في `webhookPayloadRef`.
 */
export async function storeWooOrderWebhookSnapshot(input: {
  tenantId: string;
  orderId: string;
  deliveryId: string;
  payload: unknown;
}): Promise<string> {
  const id = input.deliveryId.replace(/\//g, "_");
  const now = new Date().toISOString();
  const { error } = await getSupabaseServiceRoleClient()
    .from("webhook_ingest_logs")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      source: "woocommerce_snapshot",
      delivery_id: input.deliveryId,
      outcome: "snapshot_stored",
      metadata: {
        orderId: input.orderId,
        storedAt: now,
        payload: cloneJsonForPersistence(input.payload),
      },
      created_at: now,
    });
  if (error) throw error;
  return `${ORDER_WEBHOOK_SNAPSHOTS_SUBCOLLECTION}/${id}`;
}
