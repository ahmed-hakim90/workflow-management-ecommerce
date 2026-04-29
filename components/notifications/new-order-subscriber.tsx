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
import { useSessionStore } from "@/store/zustand/session-store";

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
 * Watches for new orders via Firestore, then chimes, shows in-app toasts, and (when permitted)
 * a system notification for background tabs.
 */
export function NewOrderSubscriber() {
  const tenantId = useSessionStore((s) => s.tenantId);
  const idToken = useSessionStore((s) => s.idToken);
  const authReady = useSessionStore((s) => s.authReady);
  const notified = useRef(new Set<string>());

  useEffect(() => {
    let dead = false;
    if (!authReady) return;
    if (!tenantId) return;
    if (!idToken?.trim()) return;
    if (!isFirebaseClientConfigured()) return;
    notified.current.clear();

    const addNewOrder = useOrderAlertsStore.getState().addNewOrder;

    const handleNew = (o: Order) => {
      if (notified.current.has(o.id)) return;
      notified.current.add(o.id);
      addNewOrder(o);
      playOrderNotificationSound();
      maybeDesktopNotify(o);
    };

    let unsubFs: (() => void) | undefined;

    const auth = getFirebaseClientAuth();
    const db = getFirebaseClientDb();
    const qo = query(
      collection(db, COLLECTIONS.orders),
      where("tenantId", "==", tenantId),
      orderBy("updatedAt", "desc"),
      limit(50),
    );

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubFs?.();
      unsubFs = undefined;
      if (dead || !user) return;

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
          (listenerErr) => {
            const code =
              listenerErr && typeof listenerErr === "object" && "code" in listenerErr
                ? String((listenerErr as { code?: string }).code)
                : "";
            if (code === "permission-denied") {
              console.warn(
                "[new-order] Firestore: permission-denied — fix Firestore rules for `orders` or disable client listeners.",
              );
            } else {
              console.warn("[new-order] Firestore listener:", listenerErr);
            }
          },
        );
      } catch {
        /* Firestore listener unavailable; do not fall back to polling full order data. */
      }
    });

    return () => {
      dead = true;
      unsubAuth?.();
      unsubFs?.();
    };
  }, [authReady, tenantId, idToken]);

  return null;
}
