import type { UserRole } from "@/lib/types/models";
import { getServerEnv } from "@/lib/config/env";
import { getFirebaseAuth } from "@/lib/db/firebase-admin";
import { getTenant } from "@/lib/services/tenants.service";
import { getUserByFirebaseUid } from "@/lib/services/users.service";

export interface RequestContext {
  tenantId: string;
  userId: string;
  role: UserRole;
  /** True when verified via OMS_API_SECRET, Firebase ID token, or tenant staffApiKey */
  authenticated: boolean;
}

const DEFAULT_TENANT =
  process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? "default";

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
 * 2) Bearer OMS_API_SECRET + X-Tenant-Id + X-User-Id + X-User-Role
 * 3) Bearer tenant `staffApiKey` + matching X-Tenant-Id + user headers
 *
 * Webhook routes should NOT use this helper.
 */
export async function requireStaffContext(req: Request): Promise<RequestContext> {
  const env = getServerEnv();
  const secret = env.OMS_API_SECRET;
  const token = getBearerToken(req);
  if (!token) throw new AuthError("Unauthorized", 401);

  const hasFirebaseAdmin = Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
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
    }
  }

  if (secret && token === secret) {
    const tenantId = req.headers.get("x-tenant-id")?.trim() ?? DEFAULT_TENANT;
    const userId = req.headers.get("x-user-id");
    const role = req.headers.get("x-user-role") as UserRole | null;
    if (!userId || !role) {
      throw new AuthError("Missing X-User-Id or X-User-Role", 400);
    }
    return { tenantId, userId, role, authenticated: true };
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
