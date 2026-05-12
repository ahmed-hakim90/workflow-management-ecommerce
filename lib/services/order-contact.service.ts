import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { logActivity } from "@/lib/services/activity.service";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import { mockListActivities } from "@/lib/dev/mock-backend";
import type { ActivityLog } from "@/lib/types/models";
import { getUser } from "@/lib/services/users.service";
import { updateOrderDoc } from "@/lib/repositories/orders.repository";

export type OrderWhatsAppSummary = {
  sentAt: string;
  sentByUserId: string;
  phone?: string;
};

/** Records that staff sent WhatsApp (opens wa.me link from UI). */
export async function logOrderWhatsAppSent(input: {
  tenantId: string;
  orderId: string;
  actorUserId: string;
  phone?: string;
}) {
  const now = new Date().toISOString();
  const actor = isDevMockDataEnabled()
    ? null
    : await getUser(input.tenantId, input.actorUserId);
  await logActivity({
    tenantId: input.tenantId,
    action: "order.whatsapp_sent",
    entityType: "order",
    entityId: input.orderId,
    userId: input.actorUserId,
    metadata: { phone: input.phone },
  });
  if (!isDevMockDataEnabled()) {
    await updateOrderDoc(
      input.orderId,
      {
          whatsappSentAt: now,
          whatsappSentByUserId: input.actorUserId,
          whatsappSentByUserName: actor?.name,
          whatsappSentPhone: input.phone,
          updatedAt: now,
      },
    );
  }
}

function activityToWhatsAppSummary(a: ActivityLog): OrderWhatsAppSummary {
  const phone =
    typeof a.metadata?.phone === "string" ? a.metadata.phone : undefined;
  return {
    sentAt: a.timestamp,
    sentByUserId: a.userId,
    phone,
  };
}

export async function listLatestOrderWhatsAppSends(
  tenantId: string,
  orderIds: string[],
): Promise<Record<string, OrderWhatsAppSummary>> {
  const wantedIds = [...new Set(orderIds.filter(Boolean))];
  if (wantedIds.length === 0) return {};

  if (isDevMockDataEnabled()) {
    return Object.fromEntries(
      wantedIds.flatMap((orderId) => {
        const latest = mockListActivities({
          tenantId,
          entityType: "order",
          entityId: orderId,
          limit: 100,
        }).find((a) => a.action === "order.whatsapp_sent");
        return latest ? [[orderId, activityToWhatsAppSummary(latest)]] : [];
      }),
    );
  }

  const wanted = new Set(wantedIds);
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("activity_logs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("entity_type", "order")
    .eq("action", "order.whatsapp_sent");
  if (error) throw error;
  const rows = (data ?? [])
    .map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      userId: row.user_id,
      metadata: row.metadata ?? {},
      timestamp: row.created_at,
    }) as ActivityLog)
    .filter((a) => wanted.has(a.entityId))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  const out: Record<string, OrderWhatsAppSummary> = {};
  for (const a of rows) {
    if (out[a.entityId]) continue;
    out[a.entityId] = activityToWhatsAppSummary(a);
  }
  return out;
}
