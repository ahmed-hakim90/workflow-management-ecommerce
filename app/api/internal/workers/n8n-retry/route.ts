import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import {
  patchOmsEventFailed,
  recordAutomationRun,
  sendToN8n,
  type N8nEventPayload,
} from "@/lib/services/chat/n8n-automation.service";
import { appendAutomationDlq } from "@/lib/services/events/automation-dlq.service";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";

export const runtime = "nodejs";

const MAX_RETRIES_BEFORE_DLQ = 5;

async function handler(req: Request) {
  const json = (await req.json()) as {
    payload?: unknown;
    omsEventId?: string;
  };
  if (!json.payload || typeof json.payload !== "object") {
    return new Response(JSON.stringify({ error: "bad_body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const payload = json.payload as N8nEventPayload;
  if (!payload.event || !payload.tenantId) {
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const retried = Number(req.headers.get("Upstash-Retried") ?? "0");

  const result = await sendToN8n(payload, {
    omsEventId: json.omsEventId,
    allowEnqueueRetry: false,
    writeDlqOnFailure: false,
  });

  if (result.status === "success") {
    return new Response(null, { status: 200 });
  }

  if (retried >= MAX_RETRIES_BEFORE_DLQ) {
    await recordAutomationRun({
      tenantId: payload.tenantId,
      eventType: payload.event,
      status: "dead_lettered",
      errorMessage: "n8n_redelivery_exhausted",
      omsEventId: json.omsEventId,
    });
    if (json.omsEventId && !isDevMockDataEnabled()) {
      await patchOmsEventFailed({
        omsEventId: json.omsEventId,
        lastError: "n8n_redelivery_exhausted",
      });
    }
    await appendAutomationDlq({
      tenantId: payload.tenantId,
      eventType: payload.event,
      payload: payload as unknown as Record<string, unknown>,
      errorMessage: "n8n_redelivery_exhausted",
      attemptCount: retried + 1,
    }).catch(() => {});
  }

  return new Response(null, { status: 500 });
}

const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
const baseUrl = process.env.OMS_PUBLIC_BASE_URL?.trim();

export const POST =
  currentKey && baseUrl
    ? verifySignatureAppRouter(handler, {
        currentSigningKey: currentKey,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
        url: baseUrl + "/api/internal/workers/n8n-retry",
      })
    : async () =>
        new Response(JSON.stringify({ error: "qstash_not_configured" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
