import { signOut } from "firebase/auth";
import { getFirebaseClientAuth, isFirebaseClientConfigured } from "./client";

export async function firebaseClientSignOut() {
  if (!isFirebaseClientConfigured()) return;
  try {
    await signOut(getFirebaseClientAuth());
  } catch {
    /* ignore */
  }
}
