import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/http/with-api";
import { getChatMessage } from "@/lib/services/chat/messages.service";
import { getWhatsAppMediaDownloadUrl } from "@/lib/services/chat/whatsapp-media.service";
import { getTenantWhatsAppCloud } from "@/lib/services/tenant-settings.service";

export const runtime = "nodejs";

function metaString(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "inbox:read");
    const url = new URL(req.url);
    const mediaId = url.searchParams.get("mediaId")?.trim();
    if (!mediaId) {
      return new Response(JSON.stringify({ error: "mediaId_required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const conversationId = url.searchParams.get("conversationId")?.trim();
    const messageId = url.searchParams.get("messageId")?.trim();
    if (conversationId && messageId) {
      const msg = await getChatMessage({
        tenantId: ctx.tenantId,
        conversationId,
        messageId,
      });
      const meta =
        msg?.metadata && typeof msg.metadata === "object" && !Array.isArray(msg.metadata)
          ? (msg.metadata as Record<string, unknown>)
          : {};
      const bound = metaString(meta.whatsappMediaId);
      if (!bound || bound !== mediaId) {
        return new Response(JSON.stringify({ error: "media_not_bound_to_message" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    const integration = await getTenantWhatsAppCloud(ctx.tenantId);
    const resolved = await getWhatsAppMediaDownloadUrl({
      integration,
      mediaId,
    });
    if (!resolved.ok) {
      return new Response(JSON.stringify({ error: resolved.error }), {
        status: resolved.status ?? 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    const bin = await fetch(resolved.url);
    if (!bin.ok) {
      return new Response(JSON.stringify({ error: "media_download_failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    const ct =
      resolved.mimeType ||
      bin.headers.get("content-type") ||
      "application/octet-stream";
    return new Response(bin.body, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
