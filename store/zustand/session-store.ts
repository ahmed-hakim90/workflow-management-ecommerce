"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "@/lib/types/models";

export interface SessionState {
  /** Per-tenant staff key from onboarding, or a demo Bearer (used when `idToken` is empty). */
  apiSecret: string;
  /** Supabase access token (preferred for browser/API auth). */
  idToken: string;
  tenantId: string;
  userId: string;
  /** Display name for shell (from profile / email). */
  displayName: string;
  /** Company/merchant name from `tenants` (see GET /api/auth/me). */
  tenantName: string;
  role: UserRole;
  permissions: string[];
  /**
   * True after Supabase Auth has emitted its first session state. Not persisted — avoids firing API calls
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
        | "permissions"
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
      permissions: [],
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
          permissions: [],
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
        permissions: s.permissions,
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
