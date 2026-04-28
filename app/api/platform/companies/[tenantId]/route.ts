import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform-context";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import {
  getPlatformTenantOverview,
} from "@/lib/services/platform-tenant-overview.service";
import { assignTenantPackage } from "@/lib/services/platform-packages.service";
import { setTenantStatus } from "@/lib/services/tenants.service";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    status: z.enum(["active", "suspended"]).optional(),
    suspendedReason: z.string().max(500).nullable().optional(),
    packageId: z.string().min(1).nullable().optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: "No fields to update",
  });

type RouteParams = {
  params: Promise<{ tenantId: string }>;
};

export async function GET(req: Request, { params }: RouteParams) {
  try {
    await requirePlatformAdmin(req);
    const { tenantId } = await params;
    const company = await getPlatformTenantOverview(tenantId);
    return jsonOk({ company });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const admin = await requirePlatformAdmin(req);
    const { tenantId } = await params;
    const body = patchSchema.parse(await req.json());

    if (body.status !== undefined) {
      await setTenantStatus({
        tenantId,
        status: body.status,
        reason: body.suspendedReason,
      });
    }

    if (body.packageId !== undefined) {
      await assignTenantPackage({
        tenantId,
        packageId: body.packageId,
        assignedBy: admin.adminId,
      });
    }

    const company = await getPlatformTenantOverview(tenantId);
    return jsonOk({ company });
  } catch (e) {
    return handleRouteError(e);
  }
}
