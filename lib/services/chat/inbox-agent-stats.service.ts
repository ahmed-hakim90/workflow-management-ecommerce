import { listRecentOrderEventsForTenant } from "@/lib/services/order-events.service";

export type InboxAgentStats = {
  since: string;
  until: string;
  sampleSize: number;
  /** chat.staff_reply count per agent userId */
  staffRepliesByUser: Record<string, number>;
  /** chat.human_takeover count per agent */
  takeoversByUser: Record<string, number>;
  /** chat.automation.decision with outcome confirm (n8n) */
  automationConfirms: number;
  /** Approx. ms from last chat.incoming to chat.staff_reply in same conversation */
  avgReplyMsByUser: Record<string, number>;
};

function parseMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export async function computeInboxAgentStats(input: {
  tenantId: string;
  /** Lookback window in days (default 7, max 30). */
  days?: number;
}): Promise<InboxAgentStats> {
  const days = Math.min(30, Math.max(1, input.days ?? 7));
  const until = new Date();
  const since = new Date(until.getTime() - days * 86400000);
  const sinceIso = since.toISOString();
  const untilIso = until.toISOString();

  const events = await listRecentOrderEventsForTenant({
    tenantId: input.tenantId,
    limit: 2000,
    sinceIso,
  });

  const staffRepliesByUser: Record<string, number> = {};
  const takeoversByUser: Record<string, number> = {};
  let automationConfirms = 0;

  const replySamples: Record<string, number[]> = {};
  const lastIncomingMsByConv: Record<string, number> = {};

  const chronological = [...events].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  for (const e of chronological) {
    if (e.action === "chat.staff_reply") {
      const uid = e.userId;
      staffRepliesByUser[uid] = (staffRepliesByUser[uid] ?? 0) + 1;
      const convId = e.metadata?.conversationId;
      if (typeof convId === "string" && convId) {
        const lastIn = lastIncomingMsByConv[convId];
        if (lastIn !== undefined) {
          const delta = parseMs(e.createdAt) - lastIn;
          if (delta >= 0 && delta < 7 * 86400000) {
            replySamples[uid] ??= [];
            replySamples[uid]!.push(delta);
          }
          delete lastIncomingMsByConv[convId];
        }
      }
    } else if (e.action === "chat.human_takeover") {
      const uid = e.userId;
      takeoversByUser[uid] = (takeoversByUser[uid] ?? 0) + 1;
    } else if (e.action === "chat.automation.decision") {
      const out = e.metadata?.outcome;
      if (out === "confirm") automationConfirms += 1;
    } else if (e.action === "chat.incoming") {
      const convId = e.metadata?.conversationId;
      if (typeof convId === "string" && convId) {
        lastIncomingMsByConv[convId] = parseMs(e.createdAt);
      }
    }
  }

  const avgReplyMsByUser: Record<string, number> = {};
  for (const [uid, samples] of Object.entries(replySamples)) {
    if (!samples.length) continue;
    const sum = samples.reduce((a, b) => a + b, 0);
    avgReplyMsByUser[uid] = Math.round(sum / samples.length);
  }

  return {
    since: sinceIso,
    until: untilIso,
    sampleSize: events.length,
    staffRepliesByUser,
    takeoversByUser,
    automationConfirms,
    avgReplyMsByUser,
  };
}
