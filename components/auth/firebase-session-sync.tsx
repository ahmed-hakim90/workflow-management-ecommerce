"use client";

import { useEffect } from "react";
import { onIdTokenChanged } from "firebase/auth";
import {
  getFirebaseClientAuth,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";
import { useSessionStore } from "@/store/zustand/session-store";

/** Keeps `idToken` in the session store aligned with Firebase Auth (refresh). */
export function FirebaseSessionSync() {
  useEffect(() => {
    if (!isFirebaseClientConfigured()) return;
    const auth = getFirebaseClientAuth();
    const unsub = onIdTokenChanged(auth, async (user) => {
      if (user) {
        const t = await user.getIdToken();
        useSessionStore.getState().setSession({ idToken: t });
      } else {
        useSessionStore.getState().setSession({ idToken: "" });
      }
    });
    return () => unsub();
  }, []);
  return null;
}
