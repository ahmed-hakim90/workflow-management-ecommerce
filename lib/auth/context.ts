import type { UserRole } from "@/lib/types/models";
import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { getTenant } from "@/lib/services/tenants.service";
import { assertStaffApiRateLimit } from "@/lib/http/api-rate-limit";
import {
  getBearerToken,
  verifySupabaseRequestUser,
} from "@/lib/supabase/session";

export interface RequestContext {
  tenantId: string;
  userId: string;
  authUserId?: string;
  role: UserRole;
  permissions: string[];
  /** True when verified via Supabase session/JWT or tenant `staffApiKey` */
  authenticated: boolean;
}

function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3;
}

/**
 * Staff auth:
 * 1) Supabase access token/session → profile by `auth.users.id`
 * 2) Bearer tenant `staffApiKey` + matching X-Tenant-Id + X-User-Id + X-User-Role
 *
 * Webhook routes should NOT use this helper.
 */
export async function requireStaffContext(req: Request): Promise<RequestContext> {
  await assertStaffApiRateLimit(req);

  const token = getBearerToken(req);
  if (!token) throw new AuthError("Unauthorized", 401);

  if (looksLikeJwt(token)) {
    try {
      const authUser = await verifySupabaseRequestUser(req);
      const supabase = getSupabaseServiceRoleClient();
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, tenant_id, role, permissions, status")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (error) throw error;
      if (!profile || profile.status !== "active") {
        throw new AuthError("User not provisioned", 403);
      }

      return {
        tenantId: profile.tenant_id,
        userId: profile.id,
        authUserId: authUser.id,
        role: profile.role as UserRole,
        permissions: Array.isArray(profile.permissions)
          ? profile.permissions
          : [],
        authenticated: true,
      };
    } catch (e) {
      if (e instanceof AuthError) throw e;
      throw new AuthError("Invalid or expired token", 401);
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
        permissions: [],
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
