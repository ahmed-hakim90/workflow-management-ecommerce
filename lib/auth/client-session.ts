import type { UserRole } from "@/lib/types/models";
import type { SessionState } from "@/store/zustand/session-store";

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
}
