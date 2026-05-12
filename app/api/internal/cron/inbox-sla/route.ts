import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { runGlobalInboxSlaCron } from "@/lib/services/chat/conversation-sla.service";

export const runtime = "nodejs";

async function handler() {
  const result = await runGlobalInboxSlaCron();
  return Response.json({ ok: true, ...result });
}

const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
const baseUrl = process.env.OMS_PUBLIC_BASE_URL?.trim();

export const POST =
  currentKey && baseUrl
    ? verifySignatureAppRouter(handler, {
        currentSigningKey: currentKey,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
        url: baseUrl + "/api/internal/cron/inbox-sla",
      })
    : async () =>
        new Response(JSON.stringify({ error: "qstash_not_configured" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
