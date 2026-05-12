import type { Order } from "@/lib/types/models";

export function splitCustomerName(name: string): { firstName: string; lastName: string } {
  const t = name.trim() || "Customer";
  const i = t.indexOf(" ");
  if (i === -1) return { firstName: t, lastName: "." };
  return { firstName: t.slice(0, i), lastName: t.slice(i + 1).trim() || "." };
}

export function codAmountFromOrder(order: Order): number {
  const p = order.payment;
  if (p.payment_status === "cod" || p.payment_status === "partial") {
    return Math.max(0, Math.round(p.cod_amount || p.remaining_amount || 0));
  }
  return 0;
}

export function orderItemCount(order: Order): number {
  return Math.max(
    1,
    order.lineItems?.reduce((sum, item) => sum + item.quantity, 0) ?? 1,
  );
}

export function orderDescription(order: Order, fallback: string): string {
  return (
    order.lineItems
      ?.map((item) => item.name)
      .filter(Boolean)
      .slice(0, 3)
      .join(", ") || fallback
  ).slice(0, 200);
}

export function pickString(
  obj: Record<string, unknown> | undefined | null,
  keys: string[],
): string | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

export function pickNumber(
  obj: Record<string, unknown> | undefined | null,
  keys: string[],
): number | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

export function nestedRecord(
  obj: Record<string, unknown> | undefined | null,
  key: string,
): Record<string, unknown> | null {
  const value = obj?.[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizeHttpBaseUrl(raw: string, fallback: string): string {
  const t = raw.trim().replace(/\/+$/, "");
  if (!t) return fallback;
  try {
    const parsed = new URL(t);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return fallback;
  }
}

export function readLabelFromBase64(data: string): Buffer {
  return Buffer.from(data, "base64");
}

