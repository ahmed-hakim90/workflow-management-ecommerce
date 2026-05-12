"use client";

import { useEffect } from "react";
import { loadSessionFromIdToken } from "@/lib/auth/client-session";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { splitDisplayName } from "@/lib/auth/split-display-name";
import { useSessionStore } from "@/store/zustand/session-store";
import { useProfileStore } from "@/store/zustand/profile-store";

function authDisplayFallback(email: string | null, displayName: unknown) {
  const fromName = typeof displayName === "string" ? displayName.trim() : "";
  if (fromName) return fromName;
  const local = email?.split("@")[0];
  if (local) return local.replace(/[._-]+/g, " ");
  return "";
}

/** Keeps session store aligned with Supabase Auth: token, profile from `/api/auth/me`, and display name. */
export function SupabaseSessionSync() {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function syncAccessToken(accessToken: string | undefined) {
      const { setSession, signOut, idToken: storeToken, setAuthReady } =
        useSessionStore.getState();
      try {
        if (accessToken) {
          try {
            await loadSessionFromIdToken(accessToken, setSession);
          } catch {
            const {
              data: { user },
            } = await supabase.auth.getUser(accessToken);
            const displayName = authDisplayFallback(
              user?.email ?? null,
              user?.user_metadata?.name,
            );
            setSession({
              idToken: accessToken,
              userId: user?.id ?? "",
              displayName,
              apiSecret: "",
            });
            const { firstName, lastName } = splitDisplayName(displayName);
            useProfileStore.getState().setProfile({ firstName, lastName });
          }
        } else if (storeToken?.trim()) {
          signOut();
        } else {
          setSession({ idToken: "" });
        }
      } finally {
        setAuthReady(true);
      }
    }

    supabase.auth
      .getSession()
      .then(({ data }) => syncAccessToken(data.session?.access_token))
      .catch(() => useSessionStore.getState().setAuthReady(true));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncAccessToken(session?.access_token);
    });
    return () => subscription.unsubscribe();
  }, []);
  return null;
}
