"use client";

import { create } from "zustand";
import type { Order } from "@/lib/types/models";

export type OrderAlertToast = {
  toastId: string;
  orderId: string;
  line1: string;
  line2: string;
};

type OrderAlertsState = {
  /** New orders since last time the bell was used (dismisses counter). */
  unreadCount: number;
  toasts: OrderAlertToast[];
  addNewOrder: (o: Order) => void;
  /** Clear badge & memory when user opens the notifications entry point. */
  markNotificationsSeen: () => void;
  dismissToast: (toastId: string) => void;
};

let toastKey = 0;
function nextToastId() {
  return `order-toast-${++toastKey}`;
}

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export const useOrderAlertsStore = create<OrderAlertsState>((set) => ({
  unreadCount: 0,
  toasts: [],
  addNewOrder: (o) =>
    set((s) => {
      const line1 = o.customer?.name?.trim() || o.id;
      const line2 = `طلب جديد — ${fmtMoney(o.payment?.total_amount ?? 0)}`;
      const t: OrderAlertToast = {
        toastId: nextToastId(),
        orderId: o.id,
        line1,
        line2,
      };
      return {
        unreadCount: s.unreadCount + 1,
        toasts: [...s.toasts, t].slice(-4),
      };
    }),
  markNotificationsSeen: () => set({ unreadCount: 0 }),
  dismissToast: (toastId) =>
    set((s) => ({ toasts: s.toasts.filter((x) => x.toastId !== toastId) })),
}));
