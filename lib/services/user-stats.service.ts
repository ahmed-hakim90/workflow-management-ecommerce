import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import { mockIncrementUserStat } from "@/lib/dev/mock-backend";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function incrementUserStat(input: {
  tenantId: string;
  userId: string;
  field: "confirmed" | "invoiced" | "packed";
}) {
  if (isDevMockDataEnabled()) {
    mockIncrementUserStat(input);
    return;
  }
  const date = todayKey();
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("user_stats")
    .select("metrics")
    .eq("tenant_id", input.tenantId)
    .eq("profile_id", input.userId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  const metrics = {
    ...((data?.metrics as Record<string, number> | null) ?? {}),
    [input.field]:
      Number(((data?.metrics as Record<string, number> | null) ?? {})[input.field] ?? 0) +
      1,
  };
  const { error: upsertError } = await supabase.from("user_stats").upsert({
    tenant_id: input.tenantId,
    profile_id: input.userId,
    date,
    metrics,
  });
  if (upsertError) throw upsertError;
}
