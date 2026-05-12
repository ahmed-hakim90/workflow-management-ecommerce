import { getServerEnv } from "@/lib/config/env";
import type { TenantWhatsAppCloudIntegration } from "@/lib/types/models";

const GRAPH_VERSION = "v21.0";

export type SendTextResult =
  | { ok: true; whatsappMessageId: string }
  | { ok: false; error: string; status?: number };

export type SendTemplateResult = SendTextResult;

function resolveToken(integration: TenantWhatsAppCloudIntegration): string | null {
  return integration.accessToken?.trim() || null;
}

function resolvePhoneNumberId(integration: TenantWhatsAppCloudIntegration): string | null {
  return integration.phoneNumberId?.trim() || null;
}

export async function sendWhatsAppTextMessage(input: {
  integration: TenantWhatsAppCloudIntegration;
  toE164: string;
  body: string;
}): Promise<SendTextResult> {
  const token = resolveToken(input.integration);
  const phoneId = resolvePhoneNumberId(input.integration);
  if (!token || !phoneId) {
    return { ok: false, error: "whatsapp_not_configured" };
  }
  const to = input.toE164.replace(/^\+/, "");
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: input.body },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err =
      (json.error as { message?: string } | undefined)?.message ||
      `http_${res.status}`;
    return { ok: false, error: err, status: res.status };
  }
  const messages = json.messages as { id?: string }[] | undefined;
  const id = messages?.[0]?.id;
  if (!id) return { ok: false, error: "no_message_id_in_response" };
  return { ok: true, whatsappMessageId: id };
}

export async function sendWhatsAppTemplateMessage(input: {
  integration: TenantWhatsAppCloudIntegration;
  toE164: string;
  templateName: string;
  languageCode: string;
  bodyParameters?: { type: "text"; text: string }[];
}): Promise<SendTemplateResult> {
  const token = resolveToken(input.integration);
  const phoneId = resolvePhoneNumberId(input.integration);
  if (!token || !phoneId) {
    return { ok: false, error: "whatsapp_not_configured" };
  }
  const to = input.toE164.replace(/^\+/, "");
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;
  const components =
    input.bodyParameters && input.bodyParameters.length
      ? [
          {
            type: "body",
            parameters: input.bodyParameters,
          },
        ]
      : [];
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        ...(components.length ? { components } : {}),
      },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err =
      (json.error as { message?: string } | undefined)?.message ||
      `http_${res.status}`;
    return { ok: false, error: err, status: res.status };
  }
  const messages = json.messages as { id?: string }[] | undefined;
  const id = messages?.[0]?.id;
  if (!id) return { ok: false, error: "no_message_id_in_response" };
  return { ok: true, whatsappMessageId: id };
}

/** App secret for webhook HMAC — tenant override ثم متغير البيئة. */
export function resolveWhatsAppAppSecret(
  integration: TenantWhatsAppCloudIntegration,
): string | null {
  const t = integration.appSecret?.trim();
  if (t) return t;
  const env = getServerEnv();
  return env.WHATSAPP_APP_SECRET?.trim() || null;
}
