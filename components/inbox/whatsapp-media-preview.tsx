"use client";

import { useEffect, useState } from "react";

export function WhatsAppMediaPreview(input: {
  mediaId: string;
  conversationId: string;
  messageId: string;
  kind: "image" | "audio" | "document";
  headers: Record<string, string>;
  fileName?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const qs = new URLSearchParams({
          mediaId: input.mediaId,
          conversationId: input.conversationId,
          messageId: input.messageId,
        });
        const res = await fetch(`/api/whatsapp/media?${qs}`, {
          headers: input.headers,
        });
        if (!res.ok) {
          if (!cancelled) setErr("Failed to load media");
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setErr("Failed to load media");
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    input.mediaId,
    input.conversationId,
    input.messageId,
    input.headers,
    input.kind,
    input.fileName,
  ]);

  if (err) {
    return <span className="text-xs text-[color:var(--color-text-muted)]">{err}</span>;
  }
  if (!url) {
    return (
      <span className="text-xs text-[color:var(--color-text-muted)]">Loading media…</span>
    );
  }
  if (input.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="mt-1 max-h-52 max-w-full rounded-md border border-[color:var(--color-border-subtle)]"
      />
    );
  }
  if (input.kind === "audio") {
    return <audio controls src={url} className="mt-1 max-w-full" />;
  }
  return (
    <a
      href={url}
      download={input.fileName || "document"}
      className="mt-1 inline-block text-xs underline"
    >
      {input.fileName || "Download file"}
    </a>
  );
}
