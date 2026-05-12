import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";

export type WhatsAppAnalyticsSnapshot = {
  periodDays: number;
  eventCounts: Record<string, number>;
  activeConversations: number;
  humanTakeoverConversations: number;
};

export async function getWhatsAppAnalytics(input: {
  tenantId: string;
  days?: number;
}): Promise<WhatsAppAnalyticsSnapshot> {
  const days = Math.min(30, Math.max(1, input.days ?? 7));
  if (isDevMockDataEnabled()) {
    return {
      periodDays: days,
      eventCounts: {},
      activeConversations: 0,
      humanTakeoverConversations: 0,
    };
  }
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const ev = await getSupabaseServiceRoleClient()
    .from("oms_events")
    .select("event_type")
    .eq("tenant_id", input.tenantId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(500);
  if (ev.error) throw ev.error;

  const eventCounts: Record<string, number> = {};
  for (const row of ev.data ?? []) {
    const t = row.event_type ?? "unknown";
    eventCounts[t] = (eventCounts[t] ?? 0) + 1;
  }

  const conv = await getSupabaseServiceRoleClient()
    .from("chat_conversations")
    .select("status, human_takeover")
    .eq("tenant_id", input.tenantId)
    .limit(300);
  if (conv.error) throw conv.error;
  let activeConversations = 0;
  let humanTakeoverConversations = 0;
  for (const c of conv.data ?? []) {
    if (c.status !== "closed") activeConversations += 1;
    if (c.human_takeover) humanTakeoverConversations += 1;
  }

  return {
    periodDays: days,
    eventCounts,
    activeConversations,
    humanTakeoverConversations,
  };
}
