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
  /** Company/merchant name from `tenants` (see GET /api/auth/me). */
  tenantName: string;
  role: UserRole;
  /**
   * True after Firebase Auth has emitted its first `onIdTokenChanged`, or immediately
   * when Firebase client is not configured. Not persisted — avoids firing API calls
   * with an empty Bearer before auth resolves.
   */
  authReady: boolean;
  setAuthReady: (ready: boolean) => void;
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
        | "tenantName"
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
      tenantName: "",
      role: "admin",
      authReady: false,
      setAuthReady: (ready) => set({ authReady: ready }),
      setSession: (p) => set(p),
      signOut: () =>
        set({
          apiSecret: "",
          idToken: "",
          userId: "",
          displayName: "",
          tenantName: "",
          tenantId: defaultTenant,
          role: "admin",
        }),
    }),
    {
      name: "Store-oms-session",
      partialize: (s) => ({
        apiSecret: s.apiSecret,
        idToken: s.idToken,
        tenantId: s.tenantId,
        userId: s.userId,
        displayName: s.displayName,
        tenantName: s.tenantName,
        role: s.role,
      }),
    },
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
