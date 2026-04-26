"use client";

import { splitDisplayName } from "@/lib/auth/split-display-name";
import type { UserRole } from "@/lib/types/models";
import type { SessionState } from "@/store/zustand/session-store";
import { useSessionStore } from "@/store/zustand/session-store";
import { useProfileStore } from "@/store/zustand/profile-store";

/** Loads `GET /api/auth/me` and syncs the session plus first/last name in `useProfileStore` (no `GET` on `/api/auth/profile` needed). */
export async function loadSessionFromIdToken(
  idToken: string,
  setSession: SessionState["setSession"],
) {
  const res = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const json = (await res.json()) as {
    ok?: boolean;
    data?: {
      user: {
        tenantId: string;
        id: string;
        name?: string;
        email?: string;
        role: string;
      };
      tenant: { id: string; name: string; slug: string } | null;
    };
    error?: string;
  };
  if (!res.ok || !json.data?.user) {
    throw new Error(json.error ?? "Could not load profile");
  }
  const u = json.data.user;
  const displayName =
    u.name?.trim() ||
    u.email?.split("@")[0]?.replace(/[._-]+/g, " ") ||
    "";
  const tenantName = json.data.tenant?.name?.trim() ?? "";
  setSession({
    idToken,
    apiSecret: "",
    tenantId: u.tenantId,
    userId: u.id,
    displayName,
    tenantName,
    role: u.role as UserRole,
  });
  const { firstName, lastName } = splitDisplayName(displayName);
  useProfileStore.getState().setProfile({ firstName, lastName });
}

/**
 * Fills `tenantName` (and server truth for `tenantId`) from `GET /api/auth/me`.
 * Use after legacy Bearer sign-in or to backfill sessions that lack company name.
 */
export async function syncSessionFromMe(): Promise<void> {
  if (typeof window === "undefined") return;
  const { idToken, apiSecret, setSession, tenantId } = useSessionStore.getState();
  const bearer = idToken?.trim() || apiSecret?.trim();
  if (!bearer) return;
  const res = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  const json = (await res.json()) as {
    ok?: boolean;
    data?: {
      user?: { tenantId: string };
      tenant: { id: string; name: string; slug: string } | null;
    };
  };
  if (!res.ok || !json.data?.user) return;
  const tenantName = json.data.tenant?.name?.trim() ?? "";
  setSession({
    tenantName,
    tenantId: json.data.user.tenantId ?? tenantId,
  });
}
