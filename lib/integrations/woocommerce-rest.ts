import type { Order } from "@/lib/types/models";
import { mapOrderStatusToWooCommerce } from "@/lib/logic/woocommerce-status-map";
import { z } from "zod";

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

export const OMS_WOOCOMMERCE_WEBHOOK_RECIPES = [
  {
    topic: "order.created",
    name: "OMS order.created",
    label: "Order created",
  },
  {
    topic: "order.updated",
    name: "OMS order.updated",
    label: "Order updated",
  },
] as const;

export const OMS_WOOCOMMERCE_WEBHOOK_TOPICS =
  OMS_WOOCOMMERCE_WEBHOOK_RECIPES.map((recipe) => recipe.topic);

export type OmsWooCommerceWebhookTopic =
  (typeof OMS_WOOCOMMERCE_WEBHOOK_RECIPES)[number]["topic"];

export type OmsWooCommerceWebhookRecipe =
  (typeof OMS_WOOCOMMERCE_WEBHOOK_RECIPES)[number];

export type WooCommerceWebhookStatus = "active" | "paused" | "disabled";

export interface WooCommerceWebhook {
  id: number;
  name: string;
  status: WooCommerceWebhookStatus;
  topic: string;
  delivery_url: string;
}

export type WooCommerceWebhookRecipeStatus = "active" | "inactive" | "missing";

export interface WooCommerceWebhookRecipeState {
  topic: OmsWooCommerceWebhookTopic;
  name: string;
  label: string;
  status: WooCommerceWebhookRecipeStatus;
  webhookId?: number;
  webhookStatus?: WooCommerceWebhookStatus;
  deliveryUrl?: string;
}

export interface WooCommerceWebhookSyncResult {
  topic: OmsWooCommerceWebhookTopic;
  action: "created" | "updated" | "already_active";
  webhookId: number;
  deliveryUrl: string;
}

export interface WooCommerceWebhookSyncTopicResult {
  topic: OmsWooCommerceWebhookTopic;
  webhookId?: number;
  deliveryUrl?: string;
  action?: "already_active" | "reactivated";
}

export interface WooCommerceWebhookSyncFailure {
  topic: OmsWooCommerceWebhookTopic;
  message: string;
}

export interface WooCommerceWebhookSyncSummary {
  created: WooCommerceWebhookSyncTopicResult[];
  skipped: WooCommerceWebhookSyncTopicResult[];
  failed: WooCommerceWebhookSyncFailure[];
}

export interface WooCommerceWebhookStoreStatus {
  deliveryUrl: string;
  allCount: number;
  matchedCount: number;
  recipes: WooCommerceWebhookRecipeState[];
}

const WOO_WEBHOOKS_PER_PAGE = 100;
const WOO_WEBHOOKS_MAX_PAGES = 50;

const wooCommerceWebhookSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.enum(["active", "paused", "disabled"]),
  topic: z.string(),
  delivery_url: z.string(),
});

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

function parseWooCommerceWebhooks(body: unknown): WooCommerceWebhook[] {
  const parsed = z.array(wooCommerceWebhookSchema).safeParse(body);
  if (!parsed.success) {
    throw new Error("Invalid WooCommerce webhooks response");
  }
  return parsed.data;
}

export function normalizeWebhookDeliveryUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed);
    const pathname = u.pathname.replace(/\/+$/, "");
    const search = u.searchParams.toString();
    return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${pathname}${
      search ? `?${search}` : ""
    }`;
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

export async function listWebhooksOnStore(
  credentials: WooRestCredentials,
): Promise<WooCommerceWebhook[]> {
  const webhooks: WooCommerceWebhook[] = [];

  for (let page = 1; page <= WOO_WEBHOOKS_MAX_PAGES; page += 1) {
    const res = await wooFetch(
      credentials,
      `/webhooks?per_page=${WOO_WEBHOOKS_PER_PAGE}&page=${page}`,
    );
    const body = await readWooJson<unknown>(res);
    const pageWebhooks = parseWooCommerceWebhooks(body);
    webhooks.push(...pageWebhooks);

    const totalPages = Number(res.headers.get("x-wp-totalpages") ?? "");
    if (Number.isFinite(totalPages) && totalPages > 0) {
      if (page >= totalPages) break;
      continue;
    }
    if (pageWebhooks.length < WOO_WEBHOOKS_PER_PAGE) break;
  }

  return webhooks;
}

function webhookName(topic: OmsWooCommerceWebhookTopic): string {
  return (
    OMS_WOOCOMMERCE_WEBHOOK_RECIPES.find((recipe) => recipe.topic === topic)
      ?.name ?? `OMS ${topic}`
  );
}

export function compareWebhooksToRecipes(input: {
  webhooks: readonly WooCommerceWebhook[];
  deliveryUrl: string;
  recipes?: readonly OmsWooCommerceWebhookRecipe[];
}): WooCommerceWebhookStoreStatus {
  const deliveryUrl = input.deliveryUrl.trim();
  const normalizedDeliveryUrl = normalizeWebhookDeliveryUrl(deliveryUrl);
  const matchedWebhooks = input.webhooks.filter(
    (webhook) =>
      normalizeWebhookDeliveryUrl(webhook.delivery_url) === normalizedDeliveryUrl,
  );
  const recipes = input.recipes ?? OMS_WOOCOMMERCE_WEBHOOK_RECIPES;

  return {
    deliveryUrl,
    allCount: input.webhooks.length,
    matchedCount: matchedWebhooks.length,
    recipes: recipes.map((recipe) => {
      const webhook = matchedWebhooks.find((w) => w.topic === recipe.topic);
      if (!webhook) {
        return { ...recipe, status: "missing" };
      }
      return {
        ...recipe,
        status: webhook.status === "active" ? "active" : "inactive",
        webhookId: webhook.id,
        webhookStatus: webhook.status,
        deliveryUrl: webhook.delivery_url,
      };
    }),
  };
}

function topicResult(
  webhook: WooCommerceWebhook,
  action?: WooCommerceWebhookSyncTopicResult["action"],
): WooCommerceWebhookSyncTopicResult {
  return {
    topic: webhook.topic as OmsWooCommerceWebhookTopic,
    webhookId: webhook.id,
    deliveryUrl: webhook.delivery_url,
    action,
  };
}

export async function syncWebhooksToWoo(input: {
  credentials: WooRestCredentials;
  deliveryUrl: string;
  secret: string;
  recipes?: readonly OmsWooCommerceWebhookRecipe[];
}): Promise<WooCommerceWebhookSyncSummary> {
  const deliveryUrl = input.deliveryUrl.trim();
  const secret = input.secret.trim();
  if (!deliveryUrl) throw new Error("Webhook delivery URL is required");
  if (!secret) throw new Error("Webhook secret is required");

  const recipes = input.recipes ?? OMS_WOOCOMMERCE_WEBHOOK_RECIPES;
  const normalizedDeliveryUrl = normalizeWebhookDeliveryUrl(deliveryUrl);
  const existing = await listWebhooksOnStore(input.credentials);
  const summary: WooCommerceWebhookSyncSummary = {
    created: [],
    skipped: [],
    failed: [],
  };

  for (const recipe of recipes) {
    const current = existing.find(
      (w) =>
        w.topic === recipe.topic &&
        normalizeWebhookDeliveryUrl(w.delivery_url) === normalizedDeliveryUrl,
    );

    try {
      if (current) {
        if (current.status === "active") {
          summary.skipped.push(topicResult(current, "already_active"));
          continue;
        }

        const res = await wooFetch(input.credentials, `/webhooks/${current.id}`, {
          method: "PUT",
          body: JSON.stringify({ status: "active" }),
        });
        const updated = wooCommerceWebhookSchema.parse(
          await readWooJson<unknown>(res),
        );
        summary.skipped.push(topicResult(updated, "reactivated"));
        continue;
      }

      const res = await wooFetch(input.credentials, "/webhooks", {
        method: "POST",
        body: JSON.stringify({
          name: recipe.name,
          topic: recipe.topic,
          delivery_url: deliveryUrl,
          secret,
          status: "active",
        }),
      });
      const created = wooCommerceWebhookSchema.parse(
        await readWooJson<unknown>(res),
      );
      summary.created.push(topicResult(created));
    } catch (e) {
      summary.failed.push({
        topic: recipe.topic,
        message: e instanceof Error ? e.message : "WooCommerce sync failed",
      });
    }
  }

  return summary;
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
  const existing = await listWebhooksOnStore(input.credentials);
  const results: WooCommerceWebhookSyncResult[] = [];
  const normalizedDeliveryUrl = normalizeWebhookDeliveryUrl(deliveryUrl);

  for (const topic of topics) {
    const current = existing.find(
      (w) =>
        w.topic === topic &&
        normalizeWebhookDeliveryUrl(w.delivery_url) === normalizedDeliveryUrl,
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
