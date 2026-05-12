import { randomBytes } from "crypto";
import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockCreateTenant,
  mockGetTenant,
  mockGetTenantBySlug,
  mockListTenants,
  mockSetTenantOwner,
  mockSetTenantStatus,
} from "@/lib/dev/mock-backend";
import { slugify } from "@/lib/string/slugify";
import type { Tenant, TenantStatus } from "@/lib/types/models";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  owner_profile_id: string | null;
  staff_api_key: string | null;
  status: TenantStatus | null;
  metadata?: { suspendedAt?: string; suspendedReason?: string } | null;
  created_at: string;
  updated_at: string;
};

function mapTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerUserId: row.owner_profile_id ?? "",
    status: row.status ?? undefined,
    suspendedAt: row.metadata?.suspendedAt,
    suspendedReason: row.metadata?.suspendedReason,
    staffApiKey: row.staff_api_key ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function duplicateTenantSlugError(slug: string) {
  const e = new Error("Company name is already registered") as Error & {
    status: number;
    slug: string;
  };
  e.status = 409;
  e.slug = slug;
  return e;
}

export async function getTenant(tenantId: string): Promise<Tenant | null> {
  if (isDevMockDataEnabled()) return mockGetTenant(tenantId);
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTenant(data as TenantRow) : null;
}

export async function listTenants(): Promise<Tenant[]> {
  if (isDevMockDataEnabled()) return mockListTenants();
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapTenant(row as TenantRow));
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const normalizedSlug = slugify(slug);
  if (isDevMockDataEnabled()) return mockGetTenantBySlug(normalizedSlug);
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("tenants")
    .select("*")
    .eq("slug", normalizedSlug)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTenant(data as TenantRow) : null;
}

export async function resolveTenantByIdOrSlug(
  value: string,
): Promise<Tenant | null> {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const byId = await getTenant(trimmed);
  if (byId) return byId;
  return getTenantBySlug(trimmed);
}

/** Creates a tenant row; set owner via `setTenantOwner` after the admin user exists. */
export async function createTenantRecord(name: string): Promise<Tenant> {
  if (isDevMockDataEnabled()) return mockCreateTenant(name);
  const staffApiKey = randomBytes(32).toString("hex");
  const slug = slugify(name);

  if (await getTenantBySlug(slug)) {
    throw duplicateTenantSlugError(slug);
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("tenants")
    .insert({
      name: name.trim(),
      slug,
      staff_api_key: staffApiKey,
      status: "active",
    })
    .select("*")
    .single();
  if (error) {
    throw duplicateTenantSlugError(slug);
  }

  try {
    await supabase.from("tenant_slugs").insert({
      slug,
      tenant_id: data.id,
    });
  } catch {
    throw duplicateTenantSlugError(slug);
  }
  return mapTenant(data as TenantRow);
}

export async function setTenantOwner(
  tenantId: string,
  ownerUserId: string,
): Promise<void> {
  if (isDevMockDataEnabled()) {
    mockSetTenantOwner(tenantId, ownerUserId);
    return;
  }
  const { error } = await getSupabaseServiceRoleClient()
    .from("tenants")
    .update({ owner_profile_id: ownerUserId })
    .eq("id", tenantId);
  if (error) throw error;
}

export async function setTenantStatus(input: {
  tenantId: string;
  status: TenantStatus;
  reason?: string | null;
}): Promise<Tenant> {
  if (isDevMockDataEnabled()) return mockSetTenantStatus(input);
  const tenant = await getTenant(input.tenantId);
  if (!tenant) {
    const e = new Error("Tenant not found") as Error & { status: number };
    e.status = 404;
    throw e;
  }
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("tenants")
    .update({
      status: input.status,
      metadata:
        input.status === "suspended"
          ? {
              suspendedAt: now,
              suspendedReason: input.reason?.trim() || undefined,
            }
          : {},
    })
    .eq("id", input.tenantId)
    .select("*")
    .single();
  if (error) throw error;
  return mapTenant(data as TenantRow);
}
