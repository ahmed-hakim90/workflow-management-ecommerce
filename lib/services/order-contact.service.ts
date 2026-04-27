import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { logActivity } from "@/lib/services/activity.service";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import { mockListActivities } from "@/lib/dev/mock-backend";
import type { ActivityLog } from "@/lib/types/models";

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
  await logActivity({
    tenantId: input.tenantId,
    action: "order.whatsapp_sent",
    entityType: "order",
    entityId: input.orderId,
    userId: input.actorUserId,
    metadata: { phone: input.phone },
  });
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
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.activityLogs)
    .where("tenantId", "==", tenantId)
    .where("entityType", "==", "order")
    .where("action", "==", "order.whatsapp_sent")
    .get();

  const rows = snap.docs
    .map((d) => d.data() as ActivityLog)
    .filter((a) => wanted.has(a.entityId))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  const out: Record<string, OrderWhatsAppSummary> = {};
  for (const a of rows) {
    if (out[a.entityId]) continue;
    out[a.entityId] = activityToWhatsAppSummary(a);
  }
  return out;
}
