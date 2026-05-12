/** Cursor pagination for orders list — يفصل الترميز عن خدمة الطلبات لسهولة الاختبار. */

export type OrderCursor = {
  createdAt: string;
  id: string;
};

export const DEFAULT_ORDER_PAGE_SIZE = 25;
export const MAX_ORDER_PAGE_SIZE = 50;

export function safeOrderPageSize(limit?: number): number {
  const numericLimit = Number.isFinite(limit ?? NaN)
    ? Math.floor(limit as number)
    : DEFAULT_ORDER_PAGE_SIZE;
  return Math.min(Math.max(numericLimit, 1), MAX_ORDER_PAGE_SIZE);
}

export function encodeOrderCursor(cursor: OrderCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeOrderCursor(cursor?: string): OrderCursor | null {
  if (!cursor?.trim()) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as Partial<OrderCursor>;
    if (typeof parsed.createdAt === "string" && typeof parsed.id === "string") {
      return { createdAt: parsed.createdAt, id: parsed.id };
    }
  } catch {
    return null;
  }
  return null;
}
