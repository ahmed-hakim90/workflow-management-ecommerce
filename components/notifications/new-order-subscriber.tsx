"use client";

import { useEffect, useRef } from "react";
import type { Order } from "@/lib/types/models";
import { playOrderNotificationSound } from "@/lib/ui/order-notification-sound";
import { useOrderAlertsStore } from "@/store/zustand/order-alerts-store";
import { buildAuthHeaders, useSessionStore } from "@/store/zustand/session-store";

function isOrderRecord(x: unknown): x is Order {
  if (!x || typeof x !== "object") return false;
  const o = x as Order;
  return (
    typeof o.id === "string" &&
    typeof o.tenantId === "string" &&
    o.customer != null &&
    o.payment != null
  );
}

function maybeDesktopNotify(o: Order) {
  if (typeof document === "undefined" || document.visibilityState !== "hidden") {
    return;
  }
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }
  const name = o.customer?.name?.trim() || o.id;
  const total = o.payment?.total_amount;
  const amount =
    typeof total === "number"
      ? total.toLocaleString("ar-EG-u-nu-latn", {
          style: "currency",
          currency: "EGP",
        })
      : "";
  new Notification("طلب جديد", {
    body: [name, amount].filter(Boolean).join(" — "),
    tag: `order-${o.id}`,
  });
}

/**
 * Watches for new orders via API polling, then chimes, shows in-app toasts, and (when permitted)
 * a system notification for background tabs.
 */
export function NewOrderSubscriber() {
  const tenantId = useSessionStore((s) => s.tenantId);
  const idToken = useSessionStore((s) => s.idToken);
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const authReady = useSessionStore((s) => s.authReady);
  const notified = useRef(new Set<string>());

  useEffect(() => {
    let dead = false;
    if (!authReady) return;
    if (!tenantId) return;
    if (!idToken?.trim()) return;
    notified.current.clear();

    const addNewOrder = useOrderAlertsStore.getState().addNewOrder;
    const headers = buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role });
    const knownIds = new Set<string>();
    let isFirst = true;

    const handleNew = (o: Order) => {
      if (notified.current.has(o.id)) return;
      notified.current.add(o.id);
      addNewOrder(o);
      playOrderNotificationSound();
      maybeDesktopNotify(o);
    };

    async function poll() {
      try {
        const res = await fetch(
          "/api/orders?status=pending_confirmation&limit=25",
          { headers },
        );
        const json = (await res.json()) as { data?: { orders?: Order[] } };
        if (dead || !res.ok) return;
        const orders = (json.data?.orders ?? []).filter(isOrderRecord);
        if (isFirst) {
          orders.forEach((order) => knownIds.add(order.id));
          isFirst = false;
          return;
        }
        for (const order of orders) {
          if (knownIds.has(order.id)) continue;
          knownIds.add(order.id);
          handleNew(order);
        }
      } catch {
        /* polling is best-effort */
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 10000);

    return () => {
      dead = true;
      window.clearInterval(timer);
    };
  }, [apiSecret, authReady, idToken, role, tenantId, userId]);

  return null;
}
