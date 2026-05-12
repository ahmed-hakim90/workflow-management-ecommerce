/**
 * Idempotent migration: rewrite legacy 9-status order data to the new 17-status model.
 *
 * Touches:
 *  - `orders.status` per tenant (writes activity log entry per change).
 *  - `tenant_settings.kanban.columns[].statuses[]`
 *  - `tenant_settings.outboundWebhooks[].statuses[]`
 *  - Triggers full rebuild of `tenant_order_stage_stats` per tenant.
 *
 * Run via tsx:
 *
 *   pnpm tsx scripts/migrate-order-statuses.ts [--tenant=<id>] [--dry-run]
 *
 * Or hit POST /api/admin/migrate-order-statuses (admin only) with
 *   { tenantId?: string, dryRun?: boolean }
 */
import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { rebuildTenantOrderStageRollup } from "@/lib/services/order-stage-rollup.service";
import { logActivity } from "@/lib/services/activity.service";
import {
  arrayNeedsMigration,
  mapLegacyStatus,
  mapLegacyStatusArray,
} from "./migrate-order-statuses.mapping";

export interface MigrateOptions {
  /** When set, only migrate the given tenant; otherwise iterate every tenant. */
  tenantId?: string;
  /** When true, no writes happen; only counts are returned. */
  dryRun?: boolean;
  /** Identity recorded as the actor on activity log entries. */
  actorUserId?: string;
}

export interface MigrateReport {
  tenantsScanned: number;
  ordersUpdated: number;
  ordersAlreadyOk: number;
  unknownStatusOrders: { id: string; status: string }[];
  kanbanSettingsUpdated: number;
  outboundWebhookConfigsUpdated: number;
  rollupsRebuilt: number;
  dryRun: boolean;
}

/** Iterate all tenant ids (or a single tenant, when provided). */
async function listTenantIds(opts: MigrateOptions): Promise<string[]> {
  if (opts.tenantId) return [opts.tenantId];
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("tenants")
    .select("id");
  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

/** Migrate a single tenant's order statuses + dependent settings. */
async function migrateTenant(
  tenantId: string,
  opts: MigrateOptions,
  report: MigrateReport,
) {
  const dryRun = !!opts.dryRun;
  const actorUserId = opts.actorUserId ?? "system:migration";

  const supabase = getSupabaseServiceRoleClient();
  const orders = await supabase
    .from("orders")
    .select("id, status")
    .eq("tenant_id", tenantId);
  if (orders.error) throw orders.error;

  let touched = false;

  for (const doc of orders.data ?? []) {
    const data = doc as { id: string; status?: string };
    const current = data.status;
    if (!current) {
      report.unknownStatusOrders.push({ id: data.id, status: "" });
      continue;
    }
    const next = mapLegacyStatus(current);
    if (!next) {
      report.unknownStatusOrders.push({ id: data.id, status: current });
      continue;
    }
    if (next === current) {
      report.ordersAlreadyOk += 1;
      continue;
    }
    report.ordersUpdated += 1;
    if (dryRun) continue;
    await supabase
      .from("orders")
      .update({ status: next, status_updated_at: new Date().toISOString() })
      .eq("id", data.id);
    await logActivity({
      tenantId,
      action: "order.status.migrated",
      entityType: "order",
      entityId: data.id,
      userId: actorUserId,
      metadata: { from: current, to: next, source: "migrate-order-statuses" },
    });
    touched = true;
  }

  // Tenant settings — kanban + outbound webhooks live in tenant_settings/{tenantId}
  const settingsResult = await supabase
    .from("tenant_settings")
    .select("kanban, outbound_webhooks")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (settingsResult.error) throw settingsResult.error;
  if (settingsResult.data) {
    const settings = settingsResult.data as {
      kanban?: {
        columns?: { id?: string; title?: string; statuses?: unknown }[];
      };
      outboundWebhooks?: { statuses?: unknown }[] | unknown;
    };

    let kanbanChanged = false;
    const nextColumns = (settings.kanban?.columns ?? []).map((col) => {
      if (!arrayNeedsMigration(col.statuses)) return col;
      kanbanChanged = true;
      return { ...col, statuses: mapLegacyStatusArray(col.statuses) };
    });
    if (kanbanChanged) {
      report.kanbanSettingsUpdated += 1;
      if (!dryRun) {
        await supabase
          .from("tenant_settings")
          .update({ kanban: { ...(settings.kanban ?? {}), columns: nextColumns } })
          .eq("tenant_id", tenantId);
        touched = true;
      }
    }

    let webhooksChanged = false;
    const rawWebhooks = settings.outboundWebhooks;
    const nextWebhooks = Array.isArray(rawWebhooks)
      ? rawWebhooks.map((wh) => {
          const w = wh as { statuses?: unknown };
          if (!arrayNeedsMigration(w.statuses)) return wh;
          webhooksChanged = true;
          return { ...w, statuses: mapLegacyStatusArray(w.statuses) };
        })
      : rawWebhooks;
    if (webhooksChanged) {
      report.outboundWebhookConfigsUpdated += 1;
      if (!dryRun) {
        await supabase
          .from("tenant_settings")
          .update({ outbound_webhooks: nextWebhooks })
          .eq("tenant_id", tenantId);
        touched = true;
      }
    }
  }

  if (touched && !dryRun) {
    await rebuildTenantOrderStageRollup(tenantId);
    report.rollupsRebuilt += 1;
  }
}

/** Public entry point used by the CLI runner and the admin API route. */
export async function runOrderStatusMigration(
  opts: MigrateOptions = {},
): Promise<MigrateReport> {
  const report: MigrateReport = {
    tenantsScanned: 0,
    ordersUpdated: 0,
    ordersAlreadyOk: 0,
    unknownStatusOrders: [],
    kanbanSettingsUpdated: 0,
    outboundWebhookConfigsUpdated: 0,
    rollupsRebuilt: 0,
    dryRun: !!opts.dryRun,
  };

  const tenantIds = await listTenantIds(opts);
  for (const tenantId of tenantIds) {
    report.tenantsScanned += 1;
    await migrateTenant(tenantId, opts, report);
  }

  return report;
}

/** CLI runner. */
async function main() {
  const args = process.argv.slice(2);
  const tenantId = args
    .find((a) => a.startsWith("--tenant="))
    ?.slice("--tenant=".length);
  const dryRun = args.includes("--dry-run");
  const report = await runOrderStatusMigration({ tenantId, dryRun });
   
  console.log(JSON.stringify(report, null, 2));
}

const isDirectRun =
  typeof require !== "undefined" && require.main === module;
if (isDirectRun) {
  main().catch((err) => {
     
    console.error(err);
    process.exit(1);
  });
}
