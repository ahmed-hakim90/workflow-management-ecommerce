import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockGetKanbanSettings,
  mockSetKanbanSettings,
} from "@/lib/dev/mock-backend";
import { mergeKanbanSettings } from "@/lib/kanban/column";
import type { TenantKanbanSettings } from "@/lib/types/models";

export async function getKanbanSettings(
  tenantId: string,
): Promise<TenantKanbanSettings> {
  if (isDevMockDataEnabled()) {
    return mergeKanbanSettings(mockGetKanbanSettings(tenantId));
  }
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("tenant_settings")
    .select("kanban")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return mergeKanbanSettings(data?.kanban ?? null);
}

export async function setKanbanSettings(
  tenantId: string,
  kanban: TenantKanbanSettings,
) {
  const merged = mergeKanbanSettings(kanban);
  if (isDevMockDataEnabled()) {
    mockSetKanbanSettings(tenantId, merged);
    return;
  }
  const { error } = await getSupabaseServiceRoleClient()
    .from("tenant_settings")
    .upsert({ tenant_id: tenantId, kanban: merged });
  if (error) throw error;
}
