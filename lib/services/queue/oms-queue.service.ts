import { getServerEnv } from "@/lib/config/env";
import {
  isQStashQueueEnabled,
  publishJsonToWorker,
  publishWhatsAppInboundJob,
  publishN8nRedeliverJob,
} from "@/lib/services/queue/qstash-queue.service";
import type { OmsLogicalQueue } from "@/lib/services/queue/queue.types";

const PATHS: Record<
  OmsLogicalQueue,
  { path: string; retries: number; retryDelay: string }
> = {
  incomingWebhookProcessing: {
    path: "/api/internal/workers/whatsapp-inbound",
    retries: 6,
    retryDelay: "30s",
  },
  outgoingMessages: {
    path: "/api/internal/workers/whatsapp-outbound",
    retries: 4,
    retryDelay: "25s",
  },
  automationEvents: {
    path: "/api/internal/workers/automation-event",
    retries: 3,
    retryDelay: "20s",
  },
  retries: {
    path: "/api/internal/workers/n8n-retry",
    retries: 5,
    retryDelay: "15s",
  },
  /** فشل نهائي — تسجيل في automation_dlq عبر المستهلك (لا مسار منفصل حالياً). */
  failedEvents: {
    path: "/api/internal/workers/n8n-retry",
    retries: 0,
    retryDelay: "1s",
  },
};

export function isOutboundWhatsAppQueueEnabled(): boolean {
  return (
    getServerEnv().WHATSAPP_OUTBOUND_QUEUE?.trim() === "1" &&
    isQStashQueueEnabled()
  );
}

/** نشر عام — يتخطى تلقائياً إذا عطّل QStash. */
export async function publishOmsQueueJob(
  queue: OmsLogicalQueue,
  body: unknown,
): Promise<void> {
  if (!isQStashQueueEnabled()) return;
  const c = PATHS[queue];
  if (queue === "failedEvents") {
    return;
  }
  await publishJsonToWorker({
    path: c.path,
    body,
    retries: c.retries,
    retryDelay: c.retryDelay,
  });
}

export async function publishIncomingWebhookJob(input: {
  tenantId: string;
  rawBody: string;
}): Promise<void> {
  await publishWhatsAppInboundJob(input);
}

export async function publishOutgoingWhatsAppTemplateJob(input: {
  tenantId: string;
  conversationId: string;
  templateName: string;
  languageCode: string;
  bodyParameters?: { type: "text"; text: string }[];
  /** مفتاح إزالة التكرار — مثلاً `${conversationId}_${templateName}_${Date}`. */
  dedupeKey: string;
}): Promise<void> {
  await publishOmsQueueJob("outgoingMessages", input);
}

export async function publishAutomationEventJob(input: {
  tenantId: string;
  event: string;
  source: "worker" | "api" | "system";
  conversationId?: string;
  orderId?: string;
  messageId?: string;
  body?: string;
  metadata?: Record<string, unknown>;
  skipN8n?: boolean;
}): Promise<void> {
  await publishOmsQueueJob("automationEvents", input);
}

export async function publishN8nRetryJob(input: {
  payload: Record<string, unknown>;
  omsEventId?: string;
}): Promise<void> {
  await publishN8nRedeliverJob(input);
}
