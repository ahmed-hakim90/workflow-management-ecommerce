import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import { executeOutboundTemplateSend } from "@/lib/services/chat/whatsapp-template-send.service";

export const runtime = "nodejs";

async function handler(req: Request) {
  const json = (await req.json()) as {
    tenantId?: string;
    conversationId?: string;
    templateName?: string;
    languageCode?: string;
    bodyParameters?: { type: "text"; text: string }[];
    dedupeKey?: string;
  };
  const tenantId = json.tenantId?.trim();
  const conversationId = json.conversationId?.trim();
  const templateName = json.templateName?.trim();
  const languageCode = json.languageCode?.trim();
  const dedupeKey = json.dedupeKey?.trim();
  if (
    !tenantId ||
    !conversationId ||
    !templateName ||
    !languageCode ||
    !dedupeKey
  ) {
    return new Response(JSON.stringify({ error: "bad_body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dedupeId = `${tenantId}_${dedupeKey}`;
  if (!isDevMockDataEnabled()) {
    const prev = await getSupabaseServiceRoleClient()
      .from("outbound_queue_dedupe")
      .select("status")
      .eq("id", dedupeId)
      .maybeSingle();
    if (prev.data?.status === "sent") {
      return new Response(null, { status: 200 });
    }
    await getSupabaseServiceRoleClient()
      .from("outbound_queue_dedupe")
      .upsert({
        id: dedupeId,
        tenant_id: tenantId,
        dedupe_key: dedupeKey,
        status: "processing",
        payload: { conversationId, templateName },
      });
  }

  const result = await executeOutboundTemplateSend({
    tenantId,
    conversationId,
    templateName,
    languageCode,
    bodyParameters: json.bodyParameters,
    senderUserId: "system:n8n",
  });

  if (result.ok) {
    if (!isDevMockDataEnabled()) {
      await getSupabaseServiceRoleClient()
        .from("outbound_queue_dedupe")
        .update({
          status: "sent",
        })
        .eq("id", dedupeId);
    }
    return new Response(null, { status: 200 });
  }

  if (!isDevMockDataEnabled()) {
    await getSupabaseServiceRoleClient()
      .from("outbound_queue_dedupe")
      .update({
        status: "failed",
        payload: { conversationId, templateName, lastError: result.error ?? "send_failed" },
      })
      .eq("id", dedupeId);
  }

  return new Response(
    JSON.stringify({ error: result.error ?? "send_failed" }),
    { status: 500, headers: { "Content-Type": "application/json" } },
  );
}

const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
const baseUrl = process.env.OMS_PUBLIC_BASE_URL?.trim();

export const POST =
  currentKey && baseUrl
    ? verifySignatureAppRouter(handler, {
        currentSigningKey: currentKey,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
        url: baseUrl + "/api/internal/workers/whatsapp-outbound",
      })
    : async () =>
        new Response(JSON.stringify({ error: "qstash_not_configured" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
