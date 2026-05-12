import { Client } from "@upstash/qstash";
import { getServerEnv } from "@/lib/config/env";

export function isQStashQueueEnabled(): boolean {
  const e = getServerEnv();
  return !!(
    e.QSTASH_TOKEN?.trim() &&
    e.OMS_PUBLIC_BASE_URL?.trim() &&
    e.QSTASH_CURRENT_SIGNING_KEY?.trim()
  );
}

function client(): Client {
  const token = getServerEnv().QSTASH_TOKEN?.trim();
  if (!token) throw new Error("QSTASH_TOKEN not configured");
  return new Client({ token });
}

function publicBaseUrl(): string {
  const u = getServerEnv().OMS_PUBLIC_BASE_URL?.trim();
  if (!u) throw new Error("OMS_PUBLIC_BASE_URL not configured");
  return u.replace(/\/$/, "");
}

export function workerUrl(path: string): string {
  const base = publicBaseUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function publishJsonToWorker(input: {
  path: string;
  body: unknown;
  retries?: number;
  retryDelay?: string;
}): Promise<void> {
  if (!isQStashQueueEnabled()) return;
  await client().publishJSON({
    url: workerUrl(input.path),
    body: input.body as Record<string, unknown>,
    retries: input.retries ?? 3,
    retryDelay: input.retryDelay ?? "20s",
  });
}

export async function publishWhatsAppInboundJob(input: {
  tenantId: string;
  rawBody: string;
}): Promise<void> {
  await publishJsonToWorker({
    path: "/api/internal/workers/whatsapp-inbound",
    body: input,
    retries: 6,
    retryDelay: "30s",
  });
}

export async function publishN8nRedeliverJob(input: {
  payload: Record<string, unknown>;
  omsEventId?: string;
}): Promise<void> {
  await publishJsonToWorker({
    path: "/api/internal/workers/n8n-retry",
    body: input,
    retries: 5,
    retryDelay: "15s",
  });
}

/** جدولة فحص SLA للصندوق الوارد (مثلاً كل دقيقة عبر QStash Schedules). */
export async function publishInboxSlaCronJob(): Promise<void> {
  await publishJsonToWorker({
    path: "/api/internal/cron/inbox-sla",
    body: {},
    retries: 2,
    retryDelay: "10s",
  });
}
