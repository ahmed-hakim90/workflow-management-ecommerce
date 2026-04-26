import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import {
  getTenantAutomation,
  setTenantAutomation,
} from "@/lib/services/tenant-settings.service";

const patchSchema = z.object({
  auto_create_shipment: z.boolean(),
  create_shipment_stage: z.enum(["confirmed", "invoiced"]),
});

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx.role, "user:manage");
    const automation = await getTenantAutomation(ctx.tenantId);
    return jsonOk(automation);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx.role, "user:manage");
    const json = await req.json();
    const body = patchSchema.parse(json);
    await setTenantAutomation(ctx.tenantId, body);
    return jsonOk(body);
  } catch (e) {
    return handleRouteError(e);
  }
}
