import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getServerEnv } from "@/lib/config/env";

const limiters = new Map<string, Ratelimit>();

function redisClient(): Redis | null {
  const e = getServerEnv();
  const url = e.UPSTASH_REDIS_REST_URL?.trim();
  const token = e.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function getLimiter(
  name: string,
  max: number,
  window: `${number} s` | `${number} m` | `${number} h` | `${number} d`,
): Ratelimit | null {
  const redis = redisClient();
  if (!redis) return null;
  const key = `${name}:${max}:${window}`;
  let rl = limiters.get(key);
  if (!rl) {
    rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, window),
      prefix: `oms_rl:${name}`,
    });
    limiters.set(key, rl);
  }
  return rl;
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xf) return xf;
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

/**
 * يعيد `Response` 429 عند تجاوز الحد، أو `null` إذا لا Redis أو ضمن الحد.
 */
export async function enforceRateLimitResponse(
  req: Request,
  opts: {
    name: string;
    max: number;
    window: `${number} s` | `${number} m` | `${number} h` | `${number} d`;
    /** مفتاح فريد لكل مستأجر/مسار */
    identifier: string;
  },
): Promise<Response | null> {
  const rl = getLimiter(opts.name, opts.max, opts.window);
  if (!rl) return null;
  const { success } = await rl.limit(opts.identifier);
  if (success) return null;
  return new Response(JSON.stringify({ error: "rate_limited" }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": "60",
    },
  });
}
