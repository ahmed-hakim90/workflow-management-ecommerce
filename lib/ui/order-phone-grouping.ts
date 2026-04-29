import type { Order } from "@/lib/types/models";

/** Digits only; compare last N digits so +20 / 0020 / 0 prefixes match. */
export function normalizePhoneForGrouping(phone: string | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits.slice(-10);
}

function sortOrdersNewestFirst(rows: Order[]): Order[] {
  return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Groups rows so orders sharing the same normalized phone appear consecutively.
 * Blocks are ordered by the newest order in each block (current page / list only).
 */
export function arrangeOrdersByDuplicatePhoneClusters(orders: Order[]): Order[] {
  const norm = normalizePhoneForGrouping;
  const withPhone: Order[] = [];
  const withoutPhone: Order[] = [];

  for (const o of orders) {
    const k = norm(o.customer.phone);
    if (!k) withoutPhone.push(o);
    else withPhone.push(o);
  }

  const byKey = new Map<string, Order[]>();
  for (const o of withPhone) {
    const k = norm(o.customer.phone)!;
    const arr = byKey.get(k) ?? [];
    arr.push(o);
    byKey.set(k, arr);
  }

  const blocks: Order[][] = [];
  for (const arr of byKey.values()) {
    blocks.push(sortOrdersNewestFirst(arr));
  }
  for (const o of withoutPhone) {
    blocks.push([o]);
  }

  blocks.sort((a, b) => {
    const maxA = Math.max(...a.map((x) => new Date(x.createdAt).getTime()));
    const maxB = Math.max(...b.map((x) => new Date(x.createdAt).getTime()));
    return maxB - maxA;
  });

  return blocks.flat();
}

export function duplicatePhoneCounts(orders: Order[]): Map<string, number> {
  const norm = normalizePhoneForGrouping;
  const counts = new Map<string, number>();
  for (const o of orders) {
    const k = norm(o.customer.phone);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

export function isDuplicateCustomerPhone(order: Order, counts: Map<string, number>): boolean {
  const k = normalizePhoneForGrouping(order.customer.phone);
  return k != null && (counts.get(k) ?? 0) > 1;
}

export function duplicatePhoneGroupSize(order: Order, counts: Map<string, number>): number {
  const k = normalizePhoneForGrouping(order.customer.phone);
  return k ? (counts.get(k) ?? 0) : 0;
}
