import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockAppendWebhookIngestLog,
  mockListWebhookIngestLogs,
} from "@/lib/dev/mock-backend";
import type {
  WebhookIngestLog,
  WebhookIngestOutcome,
  WebhookIngestSource,
} from "@/lib/types/models";

const ERR_MAX = 500;

function trimErr(msg: string | undefined): string | undefined {
  if (!msg?.trim()) return undefined;
  return msg.length > ERR_MAX ? `${msg.slice(0, ERR_MAX - 1)}…` : msg;
}

/**
 * Best-effort audit row for each WooCommerce (etc.) delivery attempt. Does not throw to callers.
 */
export function appendWebhookIngestLog(input: {
  tenantId: string;
  source: WebhookIngestSource;
  deliveryId: string;
  outcome: WebhookIngestOutcome;
  httpStatus: number;
  orderId?: string;
  wooOrderId?: string;
  errorMessage?: string;
  requestBodyBytes: number;
}): void {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const row: WebhookIngestLog = {
    id,
    tenantId: input.tenantId,
    source: input.source,
    deliveryId: input.deliveryId,
    outcome: input.outcome,
    httpStatus: input.httpStatus,
    orderId: input.orderId,
    wooOrderId: input.wooOrderId,
    errorMessage: trimErr(input.errorMessage),
    requestBodyBytes: input.requestBodyBytes,
    createdAt,
  };

  if (isDevMockDataEnabled()) {
    try {
      mockAppendWebhookIngestLog(row);
    } catch {
      /* ignore */
    }
    return;
  }

  void (async () => {
    try {
      const db = getDb();
      await db.collection(COLLECTIONS.webhookIngestLogs).doc(id).set(row);
    } catch {
      /* ignore: webhook response must not depend on log write */
    }
  })();
}

export async function listRecentWebhookIngestLogs(
  tenantId: string,
  limit: number = 30,
): Promise<WebhookIngestLog[]> {
  const cap = Math.min(Math.max(limit, 1), 100);
  if (isDevMockDataEnabled()) {
    return mockListWebhookIngestLogs(tenantId, cap);
  }
  const db = getDb();
  const q = await db
    .collection(COLLECTIONS.webhookIngestLogs)
    .where("tenantId", "==", tenantId)
    .orderBy("createdAt", "desc")
    .limit(cap)
    .get();
  return q.docs.map((d) => d.data() as WebhookIngestLog);
}
