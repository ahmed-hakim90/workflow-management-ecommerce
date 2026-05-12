import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import {
  getTenantAutomation,
  setTenantAutomation,
} from "@/lib/services/tenant-settings.service";
import { listOutboundWebhookDeliveryLogs } from "@/lib/services/outbound-webhooks.service";
import { assertTenantCanUseIntegration } from "@/lib/services/platform-packages.service";
import type { TenantOutboundWebhook } from "@/lib/types/models";

const orderStatusSchema = z.enum([
  "new",
  "pending_confirmation",
  "confirmed",
  "cancelled",
  "invoice_required",
  "invoiced",
  "ready_for_shipping",
  "awb_created",
  "warehouse_picking",
  "warehouse_packed",
  "out_for_shipping",
  "delivered",
  "failed_delivery",
  "returned",
  "exchange_requested",
  "replacement_created",
  "closed",
]);

const webhookSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  enabled: z.boolean(),
  url: z.string().url().max(2000),
  secret: z.string().max(500).nullable().optional(),
  statuses: z.array(orderStatusSchema).max(17),
  includeOrderSnapshot: z.boolean().optional(),
});

const patchSchema = z.object({
  outboundWebhooks: z.array(webhookSchema).max(10),
});

type ApiWebhook = Omit<TenantOutboundWebhook, "secret"> & {
  secretConfigured: boolean;
};

function publicWebhook(w: TenantOutboundWebhook): ApiWebhook {
  const { secret: _secret, ...rest } = w;
  return {
    ...rest,
    secretConfigured: !!_secret?.trim(),
  };
}

function mergeSecrets(
  next: z.infer<typeof webhookSchema>[],
  previous: TenantOutboundWebhook[],
): TenantOutboundWebhook[] {
  return next.map((w) => {
    const prev = previous.find((p) => p.id === w.id);
    const secret =
      w.secret === undefined
        ? prev?.secret
        : w.secret === null
          ? undefined
          : w.secret.trim() || undefined;
    return {
      id: w.id,
      name: w.name.trim(),
      enabled: w.enabled,
      url: w.url.trim(),
      secret,
      statuses: [...new Set(w.statuses)],
      includeOrderSnapshot: !!w.includeOrderSnapshot,
    };
  });
}

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:settings");
    assertCan(ctx, "user:manage");
    const automation = await getTenantAutomation(ctx.tenantId);
    const logs = await listOutboundWebhookDeliveryLogs(ctx.tenantId, 25);
    return jsonOk({
      outboundWebhooks: (automation.outboundWebhooks ?? []).map(publicWebhook),
      logs,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:settings");
    assertCan(ctx, "user:manage");
    const json = await req.json();
    const body = patchSchema.parse(json);
    const current = await getTenantAutomation(ctx.tenantId);
    const outboundWebhooks = mergeSecrets(
      body.outboundWebhooks,
      current.outboundWebhooks ?? [],
    );
    if (outboundWebhooks.some((w) => w.enabled)) {
      await assertTenantCanUseIntegration(ctx.tenantId, "outboundWebhooks");
    }
    await setTenantAutomation(ctx.tenantId, { outboundWebhooks });
    const next = await getTenantAutomation(ctx.tenantId);
    return jsonOk({
      outboundWebhooks: (next.outboundWebhooks ?? []).map(publicWebhook),
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
