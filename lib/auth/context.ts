import type { UserRole } from "@/lib/types/models";
import { getServerEnv } from "@/lib/config/env";
import { getFirebaseAuth } from "@/lib/db/firebase-admin";
import { getTenant } from "@/lib/services/tenants.service";
import { getUserByFirebaseUid } from "@/lib/services/users.service";
import { assertStaffApiRateLimit } from "@/lib/http/api-rate-limit";

export interface RequestContext {
  tenantId: string;
  userId: string;
  role: UserRole;
  /** True when verified via Firebase ID token or tenant `staffApiKey` */
  authenticated: boolean;
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
}

function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3;
}

/**
 * MVP staff auth (async):
 * 1) Firebase ID token → Firestore user by `firebaseUid`
 * 2) Bearer tenant `staffApiKey` + matching X-Tenant-Id + X-User-Id + X-User-Role
 *
 * Webhook routes should NOT use this helper.
 */
export async function requireStaffContext(req: Request): Promise<RequestContext> {
  await assertStaffApiRateLimit(req);

  const env = getServerEnv();
  const token = getBearerToken(req);
  if (!token) throw new AuthError("Unauthorized", 401);

  const hasFirebaseAdmin = Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
  const firebaseOnly =
    env.STAFF_AUTH_MODE === "firebase" && hasFirebaseAdmin;

  if (firebaseOnly && !looksLikeJwt(token)) {
    throw new AuthError("Firebase ID token required", 401);
  }

  if (looksLikeJwt(token) && !hasFirebaseAdmin) {
    throw new AuthError(
      "Set FIREBASE_SERVICE_ACCOUNT_JSON in server env (same project as NEXT_PUBLIC_*). Restart dev server.",
      401,
    );
  }

  if (hasFirebaseAdmin && looksLikeJwt(token)) {
    try {
      const decoded = await getFirebaseAuth().verifyIdToken(token);
      const user = await getUserByFirebaseUid(decoded.uid);
      if (!user) throw new AuthError("User not provisioned", 403);
      return {
        tenantId: user.tenantId,
        userId: user.id,
        role: user.role,
        authenticated: true,
      };
    } catch (e) {
      if (e instanceof AuthError) throw e;
      if (firebaseOnly) {
        throw new AuthError("Invalid or expired token", 401);
      }
    }
  }

  const tenantHeader = req.headers.get("x-tenant-id")?.trim();
  if (tenantHeader) {
    const tenant = await getTenant(tenantHeader);
    if (tenant && tenant.staffApiKey === token) {
      const userId = req.headers.get("x-user-id");
      const role = req.headers.get("x-user-role") as UserRole | null;
      if (!userId || !role) {
        throw new AuthError("Missing X-User-Id or X-User-Role", 400);
      }
      return {
        tenantId: tenant.id,
        userId,
        role,
        authenticated: true,
      };
    }
  }

  throw new AuthError("Unauthorized", 401);
}

export async function requireTenant(req: Request): Promise<RequestContext> {
  return requireStaffContext(req);
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
