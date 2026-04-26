"use client";

import { splitDisplayName } from "@/lib/auth/split-display-name";
import type { UserRole } from "@/lib/types/models";
import type { SessionState } from "@/store/zustand/session-store";
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
  setSession({
    idToken,
    apiSecret: "",
    tenantId: u.tenantId,
    userId: u.id,
    displayName,
    role: u.role as UserRole,
  });
  const { firstName, lastName } = splitDisplayName(displayName);
  useProfileStore.getState().setProfile({ firstName, lastName });
}
