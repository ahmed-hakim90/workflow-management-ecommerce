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
