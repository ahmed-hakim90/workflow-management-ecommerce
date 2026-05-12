import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import type { OrderEvent } from "@/lib/types/models";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockAppendOrderEvent,
  mockListOrderEvents,
  mockListRecentOrderEventsByTenant,
} from "@/lib/dev/mock-backend";

/**
 * سجل حدث على الطلب — مسار تدقيق أضيق من activity_logs العامة.
 */
export async function appendOrderEvent(input: {
  tenantId: string;
  orderId: string;
  action: string;
  userId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (isDevMockDataEnabled()) {
    mockAppendOrderEvent(input);
    return;
  }
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const { error } = await getSupabaseServiceRoleClient()
    .from("order_events")
    .insert({
      id,
      tenant_id: input.tenantId,
      order_id: input.orderId,
      type: input.action,
      user_id: input.userId,
      payload: input.metadata ?? {},
      created_at: createdAt,
    });
  if (error) throw error;
}

/**
 * Latest-first order audit rows (e.g. `chat.*` for WhatsApp timeline).
 */
export async function listOrderEvents(input: {
  tenantId: string;
  orderId: string;
  limit?: number;
  /** If set, only events whose `action` starts with this string (e.g. `chat.`). */
  actionPrefix?: string;
}): Promise<OrderEvent[]> {
  const cap = Math.min(200, Math.max(1, input.limit ?? 80));
  if (isDevMockDataEnabled()) {
    return mockListOrderEvents({
      tenantId: input.tenantId,
      orderId: input.orderId,
      limit: cap,
      actionPrefix: input.actionPrefix,
    });
  }
  const fetchLimit = input.actionPrefix?.trim()
    ? Math.min(300, cap * 5)
    : cap;
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("order_events")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("order_id", input.orderId)
    .order("created_at", { ascending: false })
    .limit(fetchLimit);
  if (error) throw error;
  let rows = (data ?? []).map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    action: row.type,
    userId: row.user_id,
    metadata: row.payload ?? {},
    createdAt: row.created_at,
  })) as OrderEvent[];
  if (input.actionPrefix?.trim()) {
    const p = input.actionPrefix.trim();
    rows = rows.filter((e) => e.action.startsWith(p)).slice(0, cap);
  }
  return rows;
}

/** Recent events for a tenant (e.g. inbox agent stats). Newest first. */
export async function listRecentOrderEventsForTenant(input: {
  tenantId: string;
  limit: number;
  sinceIso?: string;
}): Promise<OrderEvent[]> {
  const cap = Math.min(2500, Math.max(1, input.limit));
  if (isDevMockDataEnabled()) {
    return mockListRecentOrderEventsByTenant({
      tenantId: input.tenantId,
      limit: cap,
      sinceIso: input.sinceIso,
    });
  }
  let q = getSupabaseServiceRoleClient()
    .from("order_events")
    .select("*")
    .eq("tenant_id", input.tenantId);
  if (input.sinceIso?.trim()) q = q.gte("created_at", input.sinceIso.trim());
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .limit(cap);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    action: row.type,
    userId: row.user_id,
    metadata: row.payload ?? {},
    createdAt: row.created_at,
  })) as OrderEvent[];
}
