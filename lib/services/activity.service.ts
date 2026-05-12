import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import type {
  ActivityEntityType,
  ActivityLog,
  OrderStatus,
  UserRole,
} from "@/lib/types/models";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockAppendActivity,
  mockListActivities,
} from "@/lib/dev/mock-backend";

export async function logActivity(input: {
  tenantId: string;
  action: string;
  entityType: ActivityEntityType;
  entityId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}) {
  if (isDevMockDataEnabled()) {
    mockAppendActivity(input);
    return;
  }
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const { error } = await getSupabaseServiceRoleClient()
    .from("activity_logs")
    .insert({
    id,
    tenant_id: input.tenantId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    user_id: input.userId,
    metadata: input.metadata ?? {},
    created_at: timestamp,
  });
  if (error) throw error;
}

/**
 * Structured order-status-change activity entry.
 *
 * Stored as `action = "order.status.<toStatus>"` with metadata
 * `{ from, to, note?, role, ...extra }`. Every forward/back transition in
 * the orchestrator goes through this helper so the timeline is consistent.
 */
export async function logOrderStatusChange(input: {
  tenantId: string;
  orderId: string;
  userId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  role: UserRole;
  note?: string;
  extra?: Record<string, unknown>;
}) {
  const note = input.note?.trim();
  const metadata: Record<string, unknown> = {
    from: input.fromStatus,
    to: input.toStatus,
    role: input.role,
    ...(note ? { note: note.slice(0, 2000) } : {}),
    ...(input.extra ?? {}),
  };
  return logActivity({
    tenantId: input.tenantId,
    action: `order.status.${input.toStatus}`,
    entityType: "order",
    entityId: input.orderId,
    userId: input.userId,
    metadata,
  });
}

export async function listActivitiesForEntity(input: {
  tenantId: string;
  entityType: ActivityEntityType;
  entityId: string;
  limit?: number;
}): Promise<ActivityLog[]> {
  const limit = Math.min(input.limit ?? 100, 500);
  if (isDevMockDataEnabled()) {
    return mockListActivities({
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      limit,
    });
  }
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("activity_logs")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    userId: row.user_id,
    metadata: row.metadata ?? {},
    timestamp: row.created_at,
  })) as ActivityLog[];
}
