export const ORDER_NAV_STORAGE_KEY = "hakimo-order-nav";

export type OrderNavPayload = {
  ids: string[];
  currentId: string;
};

export function setOrderNav(ids: string[], currentId: string) {
  if (typeof window === "undefined") return;
  const unique = [...new Set(ids.filter(Boolean))];
  window.sessionStorage.setItem(
    ORDER_NAV_STORAGE_KEY,
    JSON.stringify({ ids: unique, currentId } satisfies OrderNavPayload),
  );
}

export function readOrderNav(): OrderNavPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ORDER_NAV_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as OrderNavPayload;
    if (!Array.isArray(p.ids) || !p.currentId) return null;
    return p;
  } catch {
    return null;
  }
}

export function navNeighbors(currentId: string, ids: string[]) {
  const i = ids.indexOf(currentId);
  if (i < 0) return { prevId: null as string | null, nextId: null as string | null, index: -1 };
  return {
    prevId: i > 0 ? ids[i - 1]! : null,
    nextId: i < ids.length - 1 ? ids[i + 1]! : null,
    index: i,
  };
}
