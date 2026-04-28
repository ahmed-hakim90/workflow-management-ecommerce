"use client";

import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { COLLECTIONS } from "@/lib/db/collections";
import {
  getFirebaseClientAuth,
  getFirebaseClientDb,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";
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
 * Watches for new orders via Firestore (if Firebase Auth is active) or
 * lightweight recent-order polling, then chimes, shows in-app toasts, and (when permitted)
 * a system notification for background tabs.
 */
export function NewOrderSubscriber() {
  const tenantId = useSessionStore((s) => s.tenantId);
  const idToken = useSessionStore((s) => s.idToken);
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const authReady = useSessionStore((s) => s.authReady);
  const notified = useRef(new Set<string>());

  useEffect(() => {
    let dead = false;
    if (!authReady) return;
    if (!tenantId) return;
    if (!idToken?.trim() && !apiSecret?.trim()) return;
    notified.current.clear();

    const addNewOrder = useOrderAlertsStore.getState().addNewOrder;

    const handleNew = (o: Order) => {
      if (notified.current.has(o.id)) return;
      notified.current.add(o.id);
      addNewOrder(o);
      playOrderNotificationSound();
      maybeDesktopNotify(o);
    };

    let pollT: ReturnType<typeof setInterval> | undefined;
    let unsubAuth: (() => void) | undefined;
    let unsubFs: (() => void) | undefined;

    const startPolling = (intervalMs: number) => {
      if (dead) return;
      if (pollT) {
        clearInterval(pollT);
        pollT = undefined;
      }
      const seen = new Set<string>();
      let primed = false;
      const tick = async () => {
        if (dead) return;
        try {
          const res = await fetch("/api/orders/recent?limit=10", {
            headers: buildAuthHeaders({
              ...useSessionStore.getState(),
            }),
          });
          const body = (await res.json().catch(() => ({}))) as { data?: unknown[] };
          if (!res.ok || !Array.isArray(body.data)) return;
          for (const row of body.data) {
            if (!isOrderRecord(row)) continue;
            if (!primed) {
              seen.add(row.id);
            } else if (!seen.has(row.id)) {
              seen.add(row.id);
              handleNew(row);
            }
          }
          primed = true;
        } catch {
          /* network */
        }
      };
      void tick();
      pollT = setInterval(tick, intervalMs);
    };

    void (async () => {
      let mock = false;
      try {
        const m = await fetch("/api/dev/mock-status");
        const mj = (await m.json().catch(() => ({}))) as { enabled?: boolean };
        mock = !!mj.enabled;
      } catch {
        mock = false;
      }
      if (dead) return;

      if (mock) {
        startPolling(5000);
        return;
      }

      const canFs =
        isFirebaseClientConfigured() && !!idToken?.trim() && !mock;

      if (!canFs) {
        startPolling(30000);
        return;
      }

      const auth = getFirebaseClientAuth();
      const db = getFirebaseClientDb();
      const qo = query(
        collection(db, COLLECTIONS.orders),
        where("tenantId", "==", tenantId),
        orderBy("updatedAt", "desc"),
        limit(50),
      );

      unsubAuth = onAuthStateChanged(auth, (user) => {
        unsubFs?.();
        unsubFs = undefined;
        if (dead) return;
        if (user) {
          if (pollT) {
            clearInterval(pollT);
            pollT = undefined;
          }
        } else {
          if (!pollT) startPolling(30000);
          return;
        }
        if (dead) return;
        const knownIds = new Set<string>();
        let isFirst = true;
        try {
          unsubFs = onSnapshot(
            qo,
            (snap) => {
              if (dead) return;
              if (isFirst) {
                snap.docs.forEach((d) => knownIds.add(d.id));
                isFirst = false;
                return;
              }
              for (const ch of snap.docChanges()) {
                if (ch.type !== "added") continue;
                const data = { id: ch.doc.id, ...ch.doc.data() } as Order;
                if (!isOrderRecord(data)) continue;
                if (knownIds.has(data.id)) continue;
                knownIds.add(data.id);
                handleNew(data);
              }
            },
            () => {
              unsubFs = undefined;
              if (!dead && !pollT) startPolling(30000);
            },
          );
        } catch {
          if (!dead && !pollT) startPolling(30000);
        }
      });
    })();

    return () => {
      dead = true;
      if (pollT) clearInterval(pollT);
      unsubAuth?.();
      unsubFs?.();
    };
  }, [authReady, tenantId, idToken, apiSecret]);

  return null;
}
