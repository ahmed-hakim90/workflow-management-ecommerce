import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getRequestClientIp } from "@/lib/http/client-ip";
import { AuthError } from "@/lib/auth/context";

let ratelimit: Ratelimit | null | undefined;

function getStaffApiLimiter(): Ratelimit | null {
  if (ratelimit !== undefined) return ratelimit;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    ratelimit = null;
    return null;
  }
  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(120, "60 s"),
    prefix: "Store:staff-api",
    analytics: false,
  });
  return ratelimit;
}

/**
 * Per-IP limit for routes using `requireStaffContext`. No-op if Upstash env is unset.
 */
export async function assertStaffApiRateLimit(req: Request): Promise<void> {
  const limiter = getStaffApiLimiter();
  if (!limiter) return;
  const ip = getRequestClientIp(req);
  const id = ip === "unknown" ? "unknown" : ip;
  const { success } = await limiter.limit(id);
  if (!success) {
    throw new AuthError("Too many requests", 429);
  }
}
