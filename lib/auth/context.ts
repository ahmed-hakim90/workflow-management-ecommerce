import type { UserRole } from "@/lib/types/models";
import { getServerEnv } from "@/lib/config/env";

export interface RequestContext {
  tenantId: string;
  userId: string;
  role: UserRole;
  /** True when verified via OMS_API_SECRET */
  authenticated: boolean;
}

const DEFAULT_TENANT =
  process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? "default";

function getHeader(req: Request, name: string): string | null {
  return req.headers.get(name);
}

/**
 * MVP staff auth: Bearer OMS_API_SECRET + X-Tenant-Id + X-User-Id + X-User-Role.
 * Webhook routes should NOT use this helper.
 */
export function requireStaffContext(req: Request): RequestContext {
  const env = getServerEnv();
  const secret = env.OMS_API_SECRET;
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!secret || token !== secret) {
    throw new AuthError("Unauthorized", 401);
  }

  const tenantId = getHeader(req, "x-tenant-id") ?? DEFAULT_TENANT;
  const userId = getHeader(req, "x-user-id");
  const role = getHeader(req, "x-user-role") as UserRole | null;

  if (!userId || !role) {
    throw new AuthError("Missing X-User-Id or X-User-Role", 400);
  }

  return { tenantId, userId, role, authenticated: true };
}

/** Optional context for read-only endpoints (still requires API secret). */
export function requireTenant(req: Request): RequestContext {
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
