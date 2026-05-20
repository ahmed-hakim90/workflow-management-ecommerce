"use client";

import { useEffect } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { loadSessionFromIdToken } from "@/lib/auth/client-session";
import {
  getFirebaseClientAuth,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";
import { splitDisplayName } from "@/lib/auth/split-display-name";
import { useSessionStore } from "@/store/zustand/session-store";
import { useProfileStore } from "@/store/zustand/profile-store";

function firebaseDisplayFallback(email: string | null, displayName: string | null) {
  const fromName = displayName?.trim();
  if (fromName) return fromName;
  const local = email?.split("@")[0];
  if (local) return local.replace(/[._-]+/g, " ");
  return "";
}

/** Keeps session store aligned with Firebase Auth: token, profile from `/api/auth/me`, and display name. */
export function FirebaseSessionSync() {
  useEffect(() => {
    if (!isFirebaseClientConfigured()) {
      useSessionStore.getState().setAuthReady(true);
      return;
    }
    const auth = getFirebaseClientAuth();
    const unsub = onIdTokenChanged(auth, async (user) => {
      const { setSession, signOut, idToken: storeToken, setAuthReady } =
        useSessionStore.getState();
      try {
        if (user) {
          const t = await user.getIdToken();
          try {
            await loadSessionFromIdToken(t, setSession);
          } catch {
            const displayName = firebaseDisplayFallback(
              user.email,
              user.displayName,
            );
            setSession({
              idToken: t,
              userId: user.uid,
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
    });
    return () => unsub();
  }, []);
  return null;
}
