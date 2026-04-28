import { timingSafeEqual } from "crypto";
import { AuthError } from "@/lib/auth/context";
import { getServerEnv } from "@/lib/config/env";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import type { PlatformAdminRole } from "@/lib/types/models";

export interface PlatformAdminContext {
  adminId: string;
  role: PlatformAdminRole;
  authenticated: true;
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
}

function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function requirePlatformAdmin(
  req: Request,
): Promise<PlatformAdminContext> {
  const token = getBearerToken(req);
  if (!token) throw new AuthError("Platform admin token required", 401);

  const secret = getServerEnv().PLATFORM_ADMIN_SECRET?.trim();
  const devSecret = isDevMockDataEnabled() ? "dev-super-admin" : "";
  const expected = secret || devSecret;

  if (!expected) {
    throw new AuthError("PLATFORM_ADMIN_SECRET is not configured", 503);
  }

  if (!secretsMatch(token, expected)) {
    throw new AuthError("Invalid platform admin token", 401);
  }

  return {
    adminId: "platform-admin",
    role: "owner",
    authenticated: true,
  };
}
