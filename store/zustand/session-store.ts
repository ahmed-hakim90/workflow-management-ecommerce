"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "@/lib/types/models";

export interface SessionState {
  apiSecret: string;
  tenantId: string;
  userId: string;
  role: UserRole;
  setSession: (p: Partial<Pick<SessionState, "apiSecret" | "tenantId" | "userId" | "role">>) => void;
}

const defaultTenant =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? "default"
    : "default";

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      apiSecret: "",
      tenantId: defaultTenant,
      userId: "user-admin-1",
      role: "admin",
      setSession: (p) => set(p),
    }),
    { name: "hakimo-oms-session" },
  ),
);

export function buildAuthHeaders(s: Pick<SessionState, "apiSecret" | "tenantId" | "userId" | "role">) {
  return {
    Authorization: `Bearer ${s.apiSecret}`,
    "X-Tenant-Id": s.tenantId,
    "X-User-Id": s.userId,
    "X-User-Role": s.role,
    "Content-Type": "application/json",
  } as Record<string, string>;
}
