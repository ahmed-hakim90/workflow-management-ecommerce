import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/config/env";

let serviceRoleClient: SupabaseClient | null = null;

function requireSupabaseEnv() {
  const env = getServerEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase service role client requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return env;
}

export function getSupabaseServiceRoleClient(): SupabaseClient {
  if (serviceRoleClient) return serviceRoleClient;

  const env = requireSupabaseEnv();
  serviceRoleClient = createClient(
    env.SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  return serviceRoleClient;
}

export function __resetSupabaseServiceRoleClientForTests() {
  serviceRoleClient = null;
}
