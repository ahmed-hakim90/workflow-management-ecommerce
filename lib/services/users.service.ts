import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockListUsers,
  mockCreateUser,
  mockGetUser,
  mockGetUserBySupabaseUserId,
  mockUpdateUser,
} from "@/lib/dev/mock-backend";
import type { User, UserRole } from "@/lib/types/models";
import type { Locale } from "@/lib/i18n/config";

type ProfileRow = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  language: Locale | null;
  role: UserRole;
  permissions: string[] | null;
  daily_target: number | null;
  created_at: string;
  updated_at: string;
};

function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    email: row.email ?? undefined,
    supabaseUserId: row.user_id ?? undefined,
    language: row.language ?? "en",
    role: row.role,
    permissions: row.permissions ?? [],
    daily_target: row.daily_target ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listUsers(tenantId: string): Promise<User[]> {
  if (isDevMockDataEnabled()) return mockListUsers(tenantId);
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("profiles")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapProfile(row as ProfileRow));
}

export async function countUsers(tenantId: string): Promise<number> {
  if (isDevMockDataEnabled()) return mockListUsers(tenantId).length;
  const { count, error } = await getSupabaseServiceRoleClient()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return count ?? 0;
}

export async function createUser(input: {
  tenantId: string;
  name: string;
  email?: string;
  supabaseUserId?: string;
  language?: Locale;
  role: UserRole;
  permissions?: string[];
  daily_target?: number;
  actorUserId: string;
}): Promise<User> {
  if (isDevMockDataEnabled()) return mockCreateUser(input);
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("profiles")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      email: input.email,
      user_id: input.supabaseUserId,
      language: input.language ?? "en",
      role: input.role,
      permissions: input.permissions ?? [],
      daily_target: input.daily_target ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapProfile(data as ProfileRow);
}

export async function getUser(
  tenantId: string,
  userId: string,
): Promise<User | null> {
  if (isDevMockDataEnabled()) return mockGetUser(tenantId, userId);
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function getUserBySupabaseUserId(
  supabaseUserId: string,
): Promise<User | null> {
  if (isDevMockDataEnabled()) return mockGetUserBySupabaseUserId(supabaseUserId);
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("profiles")
    .select("*")
    .eq("user_id", supabaseUserId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function updateUser(input: {
  tenantId: string;
  targetUserId: string;
  name?: string;
  language?: Locale;
  role?: UserRole;
  permissions?: string[];
  daily_target?: number;
  actorUserId: string;
}): Promise<User> {
  if (isDevMockDataEnabled()) return mockUpdateUser(input);
  const prev = await getUser(input.tenantId, input.targetUserId);
  if (!prev) {
    throw new Error("User not found");
  }
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("profiles")
    .update({
    name: input.name ?? prev.name,
    language: input.language ?? prev.language ?? "en",
    role: input.role ?? prev.role,
    permissions:
      input.permissions !== undefined ? input.permissions : prev.permissions,
    daily_target:
      input.daily_target !== undefined ? input.daily_target : prev.daily_target,
    })
    .eq("id", input.targetUserId)
    .eq("tenant_id", input.tenantId)
    .select("*")
    .single();
  if (error) throw error;
  return mapProfile(data as ProfileRow);
}
