import type { Order } from "@/lib/types/models";
import { mapOrderStatusToWooCommerce } from "@/lib/logic/woocommerce-status-map";

export function normalizeWooCommerceStoreUrl(raw: string): string {
  const t = raw.trim().replace(/\/+$/, "");
  if (!t) return "";
  try {
    const u = new URL(t);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

export function buildWooCommerceOrderAdminUrl(input: {
  storeUrl?: string | null;
  wooOrderId?: string | null;
}): string | undefined {
  const base = normalizeWooCommerceStoreUrl(input.storeUrl ?? "");
  const orderId = input.wooOrderId?.trim();
  if (!base || !orderId) return undefined;

  const params = new URLSearchParams({
    page: "wc-orders",
    action: "edit",
    id: orderId,
  });
  return `${base}/wp-admin/admin.php?${params.toString()}`;
}

function basicAuthHeader(consumerKey: string, consumerSecret: string): string {
  const token = Buffer.from(
    `${consumerKey}:${consumerSecret}`,
    "utf8",
  ).toString("base64");
  return `Basic ${token}`;
}

export interface WooRestCredentials {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

export const OMS_WOOCOMMERCE_WEBHOOK_TOPICS = [
  "order.created",
  "order.updated",
] as const;

export type OmsWooCommerceWebhookTopic =
  (typeof OMS_WOOCOMMERCE_WEBHOOK_TOPICS)[number];

type WooCommerceWebhookStatus = "active" | "paused" | "disabled";

interface WooCommerceWebhook {
  id: number;
  name: string;
  status: WooCommerceWebhookStatus;
  topic: string;
  delivery_url: string;
}

export interface WooCommerceWebhookSyncResult {
  topic: OmsWooCommerceWebhookTopic;
  action: "created" | "updated" | "already_active";
  webhookId: number;
  deliveryUrl: string;
}

async function wooFetch(
  credentials: WooRestCredentials,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const base = normalizeWooCommerceStoreUrl(credentials.storeUrl);
  if (!base) throw new Error("Invalid WooCommerce store URL");
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  headers.set(
    "Authorization",
    basicAuthHeader(credentials.consumerKey, credentials.consumerSecret),
  );
  return fetch(`${base}/wp-json/wc/v3${path}`, {
    ...init,
    headers,
  });
}

async function readWooJson<T>(res: Response): Promise<T> {
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(
      `WooCommerce REST ${res.status}: ${text.slice(0, 500) || res.statusText}`,
    );
  }
  return (text ? JSON.parse(text) : null) as T;
}

async function listWooCommerceWebhooks(
  credentials: WooRestCredentials,
): Promise<WooCommerceWebhook[]> {
  const res = await wooFetch(credentials, "/webhooks?per_page=100");
  return readWooJson<WooCommerceWebhook[]>(res);
}

function webhookName(topic: OmsWooCommerceWebhookTopic): string {
  return `OMS ${topic}`;
}

export async function syncWooCommerceOrderWebhooks(input: {
  credentials: WooRestCredentials;
  deliveryUrl: string;
  secret: string;
  topics?: readonly OmsWooCommerceWebhookTopic[];
}): Promise<WooCommerceWebhookSyncResult[]> {
  const deliveryUrl = input.deliveryUrl.trim();
  const secret = input.secret.trim();
  if (!deliveryUrl) throw new Error("Webhook delivery URL is required");
  if (!secret) throw new Error("Webhook secret is required");

  const topics = input.topics ?? OMS_WOOCOMMERCE_WEBHOOK_TOPICS;
  const existing = await listWooCommerceWebhooks(input.credentials);
  const results: WooCommerceWebhookSyncResult[] = [];

  for (const topic of topics) {
    const current = existing.find(
      (w) => w.topic === topic && w.delivery_url === deliveryUrl,
    );
    const body = {
      name: webhookName(topic),
      topic,
      delivery_url: deliveryUrl,
      secret,
      status: "active",
    };

    if (!current) {
      const res = await wooFetch(input.credentials, "/webhooks", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const created = await readWooJson<WooCommerceWebhook>(res);
      results.push({
        topic,
        action: "created",
        webhookId: created.id,
        deliveryUrl: created.delivery_url,
      });
      continue;
    }

    if (
      current.status === "active" &&
      current.name === body.name &&
      current.delivery_url === deliveryUrl
    ) {
      results.push({
        topic,
        action: "already_active",
        webhookId: current.id,
        deliveryUrl: current.delivery_url,
      });
      continue;
    }

    const res = await wooFetch(input.credentials, `/webhooks/${current.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    const updated = await readWooJson<WooCommerceWebhook>(res);
    results.push({
      topic,
      action: "updated",
      webhookId: updated.id,
      deliveryUrl: updated.delivery_url,
    });
  }

  return results;
}

export async function updateWooCommerceOrderStatus(input: {
  credentials: WooRestCredentials;
  wooOrderId: string;
  order: Order;
}): Promise<void> {
  const base = normalizeWooCommerceStoreUrl(input.credentials.storeUrl);
  if (!base) throw new Error("Invalid WooCommerce store URL");

  const wcStatus = mapOrderStatusToWooCommerce(input.order.status);
  const url = `${base}/wp-json/wc/v3/orders/${encodeURIComponent(input.wooOrderId)}`;

  const body = { status: wcStatus };

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(
        input.credentials.consumerKey,
        input.credentials.consumerSecret,
      ),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `WooCommerce REST ${res.status}: ${text.slice(0, 500) || res.statusText}`,
    );
  }
}
