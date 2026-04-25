import { logActivity } from "@/lib/services/activity.service";

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
