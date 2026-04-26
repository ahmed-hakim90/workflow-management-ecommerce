"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "@/lib/types/models";

export interface SessionState {
  /** Per-tenant staff key from onboarding, or a demo Bearer (used when `idToken` is empty). */
  apiSecret: string;
  /** Firebase ID token (preferred when using Firebase Auth). */
  idToken: string;
  tenantId: string;
  userId: string;
  /** Display name for shell (from profile / email). */
  displayName: string;
  role: UserRole;
  setSession: (
    p: Partial<
      Pick<
        SessionState,
        | "apiSecret"
        | "idToken"
        | "tenantId"
        | "userId"
        | "role"
        | "displayName"
      >
    >,
  ) => void;
  signOut: () => void;
}

const defaultTenant =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? "default"
    : "default";

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      apiSecret: "",
      idToken: "",
      tenantId: defaultTenant,
      userId: "user-admin-1",
      displayName: "",
      role: "admin",
      setSession: (p) => set(p),
      signOut: () =>
        set({
          apiSecret: "",
          idToken: "",
          userId: "",
          displayName: "",
          tenantId: defaultTenant,
          role: "admin",
        }),
    }),
    { name: "Store-oms-session" },
  ),
);

export function buildAuthHeaders(
  s: Pick<
    SessionState,
    "apiSecret" | "idToken" | "tenantId" | "userId" | "role"
  >,
) {
  const bearer = s.idToken?.trim() || s.apiSecret?.trim() || "";
  return {
    Authorization: `Bearer ${bearer}`,
    "X-Tenant-Id": s.tenantId,
    "X-User-Id": s.userId,
    "X-User-Role": s.role,
    "Content-Type": "application/json",
  } as Record<string, string>;
}
