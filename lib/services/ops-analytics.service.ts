import { getWhatsAppAnalytics } from "@/lib/services/analytics-whatsapp.service";
import type { WhatsAppAnalyticsSnapshot } from "@/lib/services/analytics-whatsapp.service";

export type OpsDerivedRates = {
  /** order.confirmed / order.confirmation.requested */
  confirmationRate: number | null;
  cancellationEvents: number;
  slaWarnings: number;
  slaBreaches: number;
  messagesReceived: number;
  messagesSent: number;
  needsHuman: number;
  classifiedReplies: number;
};

export type WhatsAppOpsSnapshot = WhatsAppAnalyticsSnapshot & {
  derived: OpsDerivedRates;
};

function count(c: Record<string, number>, key: string): number {
  return c[key] ?? 0;
}

export function deriveOpsRatesFromEventCounts(
  eventCounts: Record<string, number>,
): OpsDerivedRates {
  const confirmed = count(eventCounts, "order.confirmed");
  const requested = count(eventCounts, "order.confirmation.requested");
  return {
    confirmationRate:
      requested > 0 ? Math.round((confirmed / requested) * 1000) / 1000 : null,
    cancellationEvents: count(eventCounts, "order.cancelled"),
    slaWarnings: count(eventCounts, "sla.warning"),
    slaBreaches: count(eventCounts, "sla.breached"),
    messagesReceived: count(eventCounts, "whatsapp.message.received"),
    messagesSent: count(eventCounts, "whatsapp.message.sent"),
    needsHuman: count(eventCounts, "conversation.needs_human"),
    classifiedReplies: count(eventCounts, "chat.reply.classified"),
  };
}

export async function getWhatsAppOpsAnalytics(input: {
  tenantId: string;
  days?: number;
}): Promise<WhatsAppOpsSnapshot> {
  const base = await getWhatsAppAnalytics(input);
  return {
    ...base,
    derived: deriveOpsRatesFromEventCounts(base.eventCounts),
  };
}
