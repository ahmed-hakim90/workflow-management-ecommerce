import { listTenants, getTenant } from "@/lib/services/tenants.service";
import { listOrders } from "@/lib/services/orders.service";
import { listUsers } from "@/lib/services/users.service";
import { listTickets } from "@/lib/services/tickets.service";
import { listShipmentsForTenant } from "@/lib/services/shipments.service";
import {
  getTenantAutomation,
  getTenantIntegrations,
} from "@/lib/services/tenant-settings.service";
import { listRecentWebhookIngestLogs } from "@/lib/services/webhook-ingest-logs.service";
import {
  effectivePackageFromEntitlements,
  getTenantEntitlements,
} from "@/lib/services/platform-packages.service";
import type {
  PlatformPackage,
  Tenant,
  TenantEntitlements,
  WebhookIngestLog,
} from "@/lib/types/models";

export type IntegrationHealth = {
  connected: boolean;
  healthy: boolean | null;
  lastLog?: WebhookIngestLog;
};

export type PlatformTenantOverview = {
  tenant: Omit<Tenant, "staffApiKey"> & { staffApiKeyConfigured: boolean };
  package: PlatformPackage | null;
  entitlements: TenantEntitlements | null;
  integrations: {
    woocommerce: IntegrationHealth & {
      restConfigured: boolean;
      storeUrl: string | null;
    };
    bosta: { connected: boolean; baseUrl: string | null };
    storefrontOrders: { connected: boolean };
    outboundWebhooks: { connected: boolean; enabledCount: number; totalCount: number };
  };
  counts: {
    orders: number;
    users: number;
    tickets: number;
    shipments: number;
  };
};

function publicTenant(tenant: Tenant): PlatformTenantOverview["tenant"] {
  const { staffApiKey, ...safe } = tenant;
  return {
    ...safe,
    status: tenant.status ?? "active",
    staffApiKeyConfigured: Boolean(staffApiKey),
  };
}

function healthFromLogs(logs: WebhookIngestLog[]): {
  healthy: boolean | null;
  lastLog?: WebhookIngestLog;
} {
  const lastLog = logs[0];
  if (!lastLog) return { healthy: null };
  return { healthy: lastLog.httpStatus >= 200 && lastLog.httpStatus < 300, lastLog };
}

export async function getPlatformTenantOverview(
  tenantId: string,
): Promise<PlatformTenantOverview> {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    const e = new Error("Tenant not found") as Error & { status: number };
    e.status = 404;
    throw e;
  }

  const [
    integrations,
    orders,
    users,
    tickets,
    shipments,
    webhookLogs,
    entitlements,
    automation,
  ] = await Promise.all([
    getTenantIntegrations(tenant.id),
    listOrders(tenant.id),
    listUsers(tenant.id),
    listTickets(tenant.id),
    listShipmentsForTenant(tenant.id),
    listRecentWebhookIngestLogs(tenant.id, 10),
    getTenantEntitlements(tenant.id),
    getTenantAutomation(tenant.id),
  ]);

  const woo = integrations.woocommerce ?? {};
  const bosta = integrations.bosta ?? {};
  const storefront = integrations.storefrontOrders ?? {};
  const outbound = automation.outboundWebhooks ?? [];
  const wooHealth = healthFromLogs(
    webhookLogs.filter((log) => log.source === "woocommerce"),
  );

  return {
    tenant: publicTenant(tenant),
    package: effectivePackageFromEntitlements(entitlements),
    entitlements,
    integrations: {
      woocommerce: {
        connected: Boolean(woo.webhookSecret?.trim() || woo.storeUrl?.trim()),
        restConfigured: Boolean(
          woo.storeUrl?.trim() &&
            woo.consumerKey?.trim() &&
            woo.consumerSecret?.trim(),
        ),
        storeUrl: woo.storeUrl?.trim() || null,
        ...wooHealth,
      },
      bosta: {
        connected: Boolean(bosta.apiKey?.trim()),
        baseUrl: bosta.baseUrl?.trim() || null,
      },
      storefrontOrders: {
        connected: Boolean(storefront.webhookSecret?.trim()),
      },
      outboundWebhooks: {
        connected: outbound.length > 0,
        enabledCount: outbound.filter((w) => w.enabled).length,
        totalCount: outbound.length,
      },
    },
    counts: {
      orders: orders.length,
      users: users.length,
      tickets: tickets.length,
      shipments: shipments.length,
    },
  };
}

export async function listPlatformTenantOverviews(): Promise<
  PlatformTenantOverview[]
> {
  const tenants = await listTenants();
  return Promise.all(tenants.map((tenant) => getPlatformTenantOverview(tenant.id)));
}
