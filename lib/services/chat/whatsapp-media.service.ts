import type { TenantWhatsAppCloudIntegration } from "@/lib/types/models";

const GRAPH_VERSION = "v21.0";

function token(integration: TenantWhatsAppCloudIntegration): string | null {
  return integration.accessToken?.trim() || null;
}

/**
 * يجلب رابط تنزيل مؤقت لوسائط Cloud API (خطوة قبل GET الثنائي).
 */
export async function getWhatsAppMediaDownloadUrl(input: {
  integration: TenantWhatsAppCloudIntegration;
  mediaId: string;
}): Promise<
  | { ok: true; url: string; mimeType?: string }
  | { ok: false; error: string; status?: number }
> {
  const t = token(input.integration);
  if (!t) return { ok: false, error: "whatsapp_not_configured" };
  const id = input.mediaId.trim();
  if (!id) return { ok: false, error: "missing_media_id" };

  const metaUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${id}`;
  const res = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${t}` },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err =
      (json.error as { message?: string } | undefined)?.message ||
      `http_${res.status}`;
    return { ok: false, error: err, status: res.status };
  }
  const url = json.url != null ? String(json.url) : "";
  if (!url) return { ok: false, error: "no_url_in_media_response" };
  const mimeType =
    json.mime_type != null ? String(json.mime_type) : undefined;
  return { ok: true, url, mimeType };
}
