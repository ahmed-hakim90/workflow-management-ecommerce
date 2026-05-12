import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/config/env";

function requireSupabasePublicEnv() {
  const env = getServerEnv();
  const url = env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    env.SUPABASE_PUBLISHABLE_KEY ??
    env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase session client requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { url, publishableKey };
}

export async function createSupabaseServerClient() {
  const { url, publishableKey } = requireSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

export function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
}

export async function verifySupabaseRequestUser(req: Request): Promise<User> {
  const token = getBearerToken(req);
  const supabase = await createSupabaseServerClient();

  const result = token
    ? await supabase.auth.getUser(token)
    : await supabase.auth.getUser();

  if (result.error || !result.data.user) {
    throw new Error("Invalid or expired Supabase session");
  }

  return result.data.user;
}
