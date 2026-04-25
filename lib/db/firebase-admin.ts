import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getServerEnv } from "@/lib/config/env";

let app: App | undefined;

export function getFirebaseApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }

  const env = getServerEnv();
  const json = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set. Add service account JSON string to env for API routes.",
    );
  }
  const parsed = JSON.parse(json) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  app = initializeApp({
    credential: cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    }),
  });
  return app;
}

export function getDb() {
  return getFirestore(getFirebaseApp());
}

/** Test hook: reset cached app (vitest) */
export function __resetFirebaseAppForTests() {
  app = undefined;
}
