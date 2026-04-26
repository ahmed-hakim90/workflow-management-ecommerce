import { z } from "zod";
import { getServerEnv } from "@/lib/config/env";
import { getFirebaseAuth } from "@/lib/db/firebase-admin";
import { jsonOk, jsonError } from "@/lib/http/json";
import { getRequestClientIp } from "@/lib/http/client-ip";
import { handleRouteError } from "@/lib/http/with-api";
import { registerRateLimitOk } from "@/lib/onboarding/register-rate-limit";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  createTenantRecord,
  setTenantOwner,
} from "@/lib/services/tenants.service";
import { createUser, getUserByFirebaseUid } from "@/lib/services/users.service";

export const runtime = "nodejs";

const mockBodySchema = z.object({
  companyName: z.string().min(1).max(200),
  adminName: z.string().min(1).max(200),
  email: z.string().email(),
});

const prodBodySchema = z.object({
  companyName: z.string().min(1).max(200),
  adminName: z.string().min(1).max(200),
  idToken: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const ip = getRequestClientIp(req);
    if (!registerRateLimitOk(ip)) {
      return jsonError("Too many registration attempts", 429);
    }

    if (isDevMockDataEnabled()) {
      const body = mockBodySchema.parse(await req.json());
      const mockUid = `mock:${body.email.toLowerCase()}`;
      const existing = await getUserByFirebaseUid(mockUid);
      if (existing) {
        return jsonError("An account with this email is already registered", 409);
      }
      const tenant = await createTenantRecord(body.companyName);
      const user = await createUser({
        tenantId: tenant.id,
        name: body.adminName,
        email: body.email,
        firebaseUid: mockUid,
        role: "admin",
        actorUserId: "system:onboarding",
      });
      await setTenantOwner(tenant.id, user.id);
      return jsonOk({
        tenantId: tenant.id,
        userId: user.id,
        staffApiKey: tenant.staffApiKey,
        mode: "mock",
      });
    }

    const env = getServerEnv();
    if (!env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) {
      return jsonError("Registration requires Firebase Admin on the server", 503);
    }

    const body = prodBodySchema.parse(await req.json());
    let decoded: { uid: string; email?: string };
    try {
      decoded = await getFirebaseAuth().verifyIdToken(body.idToken);
    } catch {
      return jsonError(
        "Could not verify ID token. Use one Firebase project for both: NEXT_PUBLIC_FIREBASE_* (web app) and FIREBASE_SERVICE_ACCOUNT_JSON (service account JSON from the same project). Then restart the dev server.",
        401,
      );
    }

    const existingUser = await getUserByFirebaseUid(decoded.uid);
    if (existingUser) {
      return jsonError("This Firebase account is already registered", 409);
    }

    const email = decoded.email?.trim();
    if (!email) {
      return jsonError("Your Firebase account has no email claim", 400);
    }

    const tenant = await createTenantRecord(body.companyName);
    const user = await createUser({
      tenantId: tenant.id,
      name: body.adminName,
      email,
      firebaseUid: decoded.uid,
      role: "admin",
      actorUserId: "system:onboarding",
    });
    await setTenantOwner(tenant.id, user.id);
    return jsonOk({
      tenantId: tenant.id,
      userId: user.id,
      staffApiKey: tenant.staffApiKey,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
