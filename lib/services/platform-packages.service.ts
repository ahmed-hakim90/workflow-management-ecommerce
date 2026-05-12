import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockAssignTenantPackage,
  mockCreatePlatformPackage,
  mockGetPlatformPackage,
  mockGetTenantEntitlements,
  mockListPlatformPackages,
  mockUpdatePlatformPackage,
} from "@/lib/dev/mock-backend";
import { countOrders } from "@/lib/services/orders.service";
import { listUsers } from "@/lib/services/users.service";
import type {
  PlatformPackage,
  PlatformPackageFeatures,
  PlatformPackageLimits,
  PlatformSupportTier,
  TenantEntitlements,
} from "@/lib/types/models";

export type IntegrationFeature = keyof PlatformPackageFeatures;

export const DEFAULT_PACKAGE_FEATURES: PlatformPackageFeatures = {
  woocommerce: true,
  bosta: true,
  jntEgypt: true,
  fedex: true,
  storefrontOrders: true,
  outboundWebhooks: true,
  whatsapp: true,
};

function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

function normalizeLimits(limits?: PlatformPackageLimits): PlatformPackageLimits {
  return {
    ...(limits?.maxUsers !== undefined
      ? { maxUsers: Math.max(0, Math.floor(limits.maxUsers)) }
      : {}),
    ...(limits?.maxOrdersPerMonth !== undefined
      ? {
          maxOrdersPerMonth: Math.max(
            0,
            Math.floor(limits.maxOrdersPerMonth),
          ),
        }
      : {}),
    ...(limits?.maxWebhookEventsPerMonth !== undefined
      ? {
          maxWebhookEventsPerMonth: Math.max(
            0,
            Math.floor(limits.maxWebhookEventsPerMonth),
          ),
        }
      : {}),
  };
}

function normalizeFeatures(
  features?: Partial<PlatformPackageFeatures>,
): PlatformPackageFeatures {
  return {
    ...DEFAULT_PACKAGE_FEATURES,
    ...(features ?? {}),
  };
}

export async function listPlatformPackages(): Promise<PlatformPackage[]> {
  if (isDevMockDataEnabled()) return mockListPlatformPackages();
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("platform_packages")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    active: row.active,
    limits: row.limits ?? {},
    features: normalizeFeatures(row.features ?? {}),
    supportTier: row.support_tier ?? "standard",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) as PlatformPackage[];
}

export async function getPlatformPackage(
  packageId: string,
): Promise<PlatformPackage | null> {
  if (isDevMockDataEnabled()) return mockGetPlatformPackage(packageId);
  return (await listPlatformPackages()).find((pkg) => pkg.id === packageId) ?? null;
}

export async function createPlatformPackage(input: {
  name: string;
  description?: string;
  limits?: PlatformPackageLimits;
  features?: Partial<PlatformPackageFeatures>;
  supportTier?: PlatformSupportTier;
  active?: boolean;
}): Promise<PlatformPackage> {
  const now = new Date().toISOString();
  const pkg: PlatformPackage = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    active: input.active ?? true,
    limits: normalizeLimits(input.limits),
    features: normalizeFeatures(input.features),
    supportTier: input.supportTier ?? "standard",
    createdAt: now,
    updatedAt: now,
  };
  if (!pkg.name) throw httpError("Package name is required", 422);
  if (isDevMockDataEnabled()) return mockCreatePlatformPackage(pkg);
  const { error } = await getSupabaseServiceRoleClient()
    .from("platform_packages")
    .insert({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      active: pkg.active,
      limits: pkg.limits,
      features: pkg.features,
      support_tier: pkg.supportTier,
      created_at: pkg.createdAt,
      updated_at: pkg.updatedAt,
    });
  if (error) throw error;
  return pkg;
}

export async function updatePlatformPackage(input: {
  packageId: string;
  name?: string;
  description?: string | null;
  limits?: PlatformPackageLimits;
  features?: Partial<PlatformPackageFeatures>;
  supportTier?: PlatformSupportTier;
  active?: boolean;
}): Promise<PlatformPackage> {
  if (isDevMockDataEnabled()) return mockUpdatePlatformPackage(input);
  const current = await getPlatformPackage(input.packageId);
  if (!current) throw httpError("Package not found", 404);
  const next: PlatformPackage = {
    ...current,
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.description !== undefined
      ? { description: input.description?.trim() || undefined }
      : {}),
    ...(input.limits !== undefined
      ? { limits: normalizeLimits(input.limits) }
      : {}),
    ...(input.features !== undefined
      ? { features: normalizeFeatures(input.features) }
      : {}),
    ...(input.supportTier !== undefined ? { supportTier: input.supportTier } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
    updatedAt: new Date().toISOString(),
  };
  if (!next.name) throw httpError("Package name is required", 422);
  const { error } = await getSupabaseServiceRoleClient()
    .from("platform_packages")
    .update({
      name: next.name,
      description: next.description,
      active: next.active,
      limits: next.limits,
      features: next.features,
      support_tier: next.supportTier,
      updated_at: next.updatedAt,
    })
    .eq("id", input.packageId);
  if (error) throw error;
  return next;
}

export async function getTenantEntitlements(
  tenantId: string,
): Promise<TenantEntitlements | null> {
  if (isDevMockDataEnabled()) return mockGetTenantEntitlements(tenantId);
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("tenant_entitlements")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? ({
        tenantId: data.tenant_id,
        packageId: data.package_id,
        packageSnapshot: data.package_snapshot ?? undefined,
        overrides: data.overrides ?? undefined,
        assignedAt: data.created_at,
        assignedBy: data.assigned_by ?? "",
        updatedAt: data.updated_at,
      } as TenantEntitlements)
    : null;
}

export async function assignTenantPackage(input: {
  tenantId: string;
  packageId: string | null;
  assignedBy: string;
}): Promise<TenantEntitlements> {
  const pkg = input.packageId
    ? await getPlatformPackage(input.packageId)
    : null;
  if (input.packageId && !pkg) throw httpError("Package not found", 404);
  const now = new Date().toISOString();
  const entitlements: TenantEntitlements = {
    tenantId: input.tenantId,
    packageId: input.packageId,
    packageSnapshot: pkg ?? undefined,
    assignedAt: now,
    assignedBy: input.assignedBy,
    updatedAt: now,
  };
  if (isDevMockDataEnabled()) return mockAssignTenantPackage(entitlements);
  const { error } = await getSupabaseServiceRoleClient()
    .from("tenant_entitlements")
    .upsert({
      tenant_id: input.tenantId,
      package_id: input.packageId,
      package_snapshot: pkg ?? {},
      assigned_by: input.assignedBy,
      updated_at: now,
    });
  if (error) throw error;
  return entitlements;
}

export function effectivePackageFromEntitlements(
  entitlements: TenantEntitlements | null,
): PlatformPackage | null {
  const pkg = entitlements?.packageSnapshot;
  if (!pkg) return null;
  const { features, supportTier, ...limitOverrides } = entitlements.overrides ?? {};
  return {
    ...pkg,
    limits: { ...pkg.limits, ...limitOverrides },
    features: {
      ...DEFAULT_PACKAGE_FEATURES,
      ...pkg.features,
      ...(features ?? {}),
    },
    supportTier: supportTier ?? pkg.supportTier,
  };
}

export async function assertTenantCanCreateUser(tenantId: string) {
  const pkg = effectivePackageFromEntitlements(
    await getTenantEntitlements(tenantId),
  );
  const maxUsers = pkg?.limits.maxUsers;
  if (maxUsers === undefined) return;
  const users = await listUsers(tenantId);
  if (users.length >= maxUsers) {
    throw httpError(`Package user limit reached (${maxUsers})`, 402);
  }
}

export async function assertTenantCanUseIntegration(
  tenantId: string,
  feature: IntegrationFeature,
) {
  const pkg = effectivePackageFromEntitlements(
    await getTenantEntitlements(tenantId),
  );
  if (!pkg || pkg.features[feature]) return;
  throw httpError(`Your package does not include ${feature}`, 402);
}

export async function assertTenantCanIngestOrder(tenantId: string) {
  const pkg = effectivePackageFromEntitlements(
    await getTenantEntitlements(tenantId),
  );
  const maxOrders = pkg?.limits.maxOrdersPerMonth;
  if (maxOrders === undefined) return;
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);
  const ordersThisMonth = await countOrders(tenantId, { from: monthStart });
  if (ordersThisMonth >= maxOrders) {
    throw httpError(`Package monthly order limit reached (${maxOrders})`, 402);
  }
}
