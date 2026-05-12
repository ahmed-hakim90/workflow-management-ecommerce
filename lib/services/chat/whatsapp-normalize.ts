import type { ChatMessageType } from "@/lib/types/chat";

export type NormalizedInboundText = {
  kind: "message";
  from: string;
  /** WhatsApp message id (wamid). */
  messageId: string;
  timestamp: string;
  type: ChatMessageType;
  body: string;
  /** Profile name when present. */
  profileName?: string;
  /** Cloud API media id (image/audio/document). */
  mediaId?: string;
  mimeType?: string;
  fileName?: string;
};

export type NormalizedStatus = {
  kind: "status";
  messageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
};

export type NormalizedWhatsAppPayload =
  | NormalizedInboundText
  | NormalizedStatus
  | { kind: "ignored"; reason: string };

/**
 * يحوّل جسم webhook ميتا إلى أحداث موحّدة — نتجاهل أنواع غير مدعومة لتفادي كسر المعالج.
 */
export function normalizeWhatsAppWebhookBody(body: unknown): NormalizedWhatsAppPayload[] {
  const out: NormalizedWhatsAppPayload[] = [];
  if (!body || typeof body !== "object") return out;
  const root = body as Record<string, unknown>;
  const entries = root.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const changes = (entry as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const value = (change as { value?: unknown }).value;
      if (!value || typeof value !== "object") continue;
      const v = value as Record<string, unknown>;

      const statuses = v.statuses;
      if (Array.isArray(statuses)) {
        for (const st of statuses) {
          if (!st || typeof st !== "object") continue;
          const s = st as Record<string, unknown>;
          const id = s.id != null ? String(s.id) : "";
          const stStatus = String(s.status ?? "").toLowerCase();
          if (!id) continue;
          const ts = s.timestamp != null ? String(s.timestamp) : "";
          const iso =
            ts && /^\d+$/.test(ts)
              ? new Date(parseInt(ts, 10) * 1000).toISOString()
              : new Date().toISOString();
          if (stStatus === "sent") {
            out.push({ kind: "status", messageId: id, status: "sent", timestamp: iso });
          } else if (stStatus === "delivered") {
            out.push({
              kind: "status",
              messageId: id,
              status: "delivered",
              timestamp: iso,
            });
          } else if (stStatus === "read") {
            out.push({ kind: "status", messageId: id, status: "read", timestamp: iso });
          } else if (stStatus === "failed") {
            out.push({ kind: "status", messageId: id, status: "failed", timestamp: iso });
          }
        }
      }

      const messages = v.messages;
      if (Array.isArray(messages)) {
        for (const msg of messages) {
          if (!msg || typeof msg !== "object") continue;
          const m = msg as Record<string, unknown>;
          const from = m.from != null ? String(m.from) : "";
          const wamid = m.id != null ? String(m.id) : "";
          const ts = m.timestamp != null ? String(m.timestamp) : "";
          const iso =
            ts && /^\d+$/.test(ts)
              ? new Date(parseInt(ts, 10) * 1000).toISOString()
              : new Date().toISOString();
          if (!from || !wamid) continue;
          const type = String(m.type ?? "text").toLowerCase();
          let bodyText = "";
          let msgType: ChatMessageType = "text";
          if (type === "text") {
            const text = m.text as { body?: string } | undefined;
            bodyText = text?.body != null ? String(text.body) : "";
            msgType = "text";
          } else if (type === "interactive") {
            msgType = "interactive";
            const inter = m.interactive as Record<string, unknown> | undefined;
            bodyText = JSON.stringify(inter ?? {});
          } else if (type === "image") {
            msgType = "image";
            const img = m.image as
              | { id?: string; caption?: string; mime_type?: string }
              | undefined;
            const mediaId = img?.id != null ? String(img.id) : "";
            bodyText = (img?.caption != null ? String(img.caption) : "") || "[image]";
            const contacts = v.contacts;
            let profileName: string | undefined;
            if (Array.isArray(contacts) && contacts[0] && typeof contacts[0] === "object") {
              const profile = (contacts[0] as { profile?: { name?: string } }).profile;
              profileName = profile?.name?.trim();
            }
            out.push({
              kind: "message",
              from,
              messageId: wamid,
              timestamp: iso,
              type: msgType,
              body: bodyText,
              profileName,
              mediaId: mediaId || undefined,
              mimeType: img?.mime_type != null ? String(img.mime_type) : undefined,
            });
            continue;
          } else if (type === "audio") {
            msgType = "audio";
            const aud = m.audio as
              | { id?: string; mime_type?: string }
              | undefined;
            const mediaId = aud?.id != null ? String(aud.id) : "";
            bodyText = "[audio]";
            const contacts = v.contacts;
            let profileName: string | undefined;
            if (Array.isArray(contacts) && contacts[0] && typeof contacts[0] === "object") {
              const profile = (contacts[0] as { profile?: { name?: string } }).profile;
              profileName = profile?.name?.trim();
            }
            out.push({
              kind: "message",
              from,
              messageId: wamid,
              timestamp: iso,
              type: msgType,
              body: bodyText,
              profileName,
              mediaId: mediaId || undefined,
              mimeType: aud?.mime_type != null ? String(aud.mime_type) : undefined,
            });
            continue;
          } else if (type === "document") {
            msgType = "document";
            const doc = m.document as
              | { id?: string; filename?: string; mime_type?: string; caption?: string }
              | undefined;
            const mediaId = doc?.id != null ? String(doc.id) : "";
            const fn = doc?.filename != null ? String(doc.filename) : "";
            bodyText =
              (doc?.caption != null ? String(doc.caption) : "") ||
              (fn ? `[document:${fn}]` : "[document]");
            const contacts = v.contacts;
            let profileName: string | undefined;
            if (Array.isArray(contacts) && contacts[0] && typeof contacts[0] === "object") {
              const profile = (contacts[0] as { profile?: { name?: string } }).profile;
              profileName = profile?.name?.trim();
            }
            out.push({
              kind: "message",
              from,
              messageId: wamid,
              timestamp: iso,
              type: msgType,
              body: bodyText,
              profileName,
              mediaId: mediaId || undefined,
              mimeType: doc?.mime_type != null ? String(doc.mime_type) : undefined,
              fileName: fn || undefined,
            });
            continue;
          } else {
            out.push({ kind: "ignored", reason: `unsupported_type:${type}` });
            continue;
          }
          const contacts = v.contacts;
          let profileName: string | undefined;
          if (Array.isArray(contacts) && contacts[0] && typeof contacts[0] === "object") {
            const profile = (contacts[0] as { profile?: { name?: string } }).profile;
            profileName = profile?.name?.trim();
          }
          out.push({
            kind: "message",
            from,
            messageId: wamid,
            timestamp: iso,
            type: msgType,
            body: bodyText,
            profileName,
          });
        }
      }
    }
  }
  return out;
}

export function phoneNumberIdFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const entries = (body as { entry?: unknown }).entry;
  if (!Array.isArray(entries) || !entries[0]) return undefined;
  const changes = (entries[0] as { changes?: unknown }).changes;
  if (!Array.isArray(changes) || !changes[0]) return undefined;
  const md = (changes[0] as { value?: { metadata?: { phone_number_id?: string } } })
    .value?.metadata;
  return md?.phone_number_id?.trim();
}
