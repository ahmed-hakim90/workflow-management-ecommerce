import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import {
  getWarehouseSettings,
  setTenantWarehouseSettings,
} from "@/lib/services/tenant-settings.service";

const patchSchema = z.object({
  singleScanFulfills: z.boolean().optional(),
  scanCooldownMs: z.number().int().min(0).nullable().optional(),
});

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:settings");
    assertCan(ctx, "order:read");
    const warehouse = await getWarehouseSettings(ctx.tenantId);
    return jsonOk(warehouse);
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
    await setTenantWarehouseSettings(ctx.tenantId, body);
    const warehouse = await getWarehouseSettings(ctx.tenantId);
    return jsonOk(warehouse);
  } catch (e) {
    return handleRouteError(e);
  }
}
