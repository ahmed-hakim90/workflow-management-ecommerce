import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { runOrderStatusMigration } from "@/scripts/migrate-order-statuses";

const bodySchema = z
  .object({
    /** When set, override the caller's tenantId (platform-admin scenario). */
    tenantId: z.string().min(1).optional(),
    dryRun: z.boolean().optional(),
  })
  .strict();

/**
 * POST /api/admin/migrate-order-statuses
 *
 * Idempotent migration that rewrites legacy 9-status data to the new
 * 17-status model. Always scoped to the caller's tenant unless an admin
 * supplies an explicit tenantId in the body.
 *
 * الـ migration بيرجع رسالة فيها كل اللي اتعمل (orders, kanban, webhooks),
 * فلو بصيت في الرد تعرف كل اللي اتغير قبل ما تعتمد الـ dryRun.
 */
export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:admin");

    const json = await req.json().catch(() => ({}));
    const body = bodySchema.parse(json);

    const targetTenantId = body.tenantId ?? ctx.tenantId;
    if (body.tenantId && body.tenantId !== ctx.tenantId) {
      // Cross-tenant migration is restricted to platform-admin path; we only
      // expose tenant-scoped runs here to keep blast radius small.
      return jsonError("Cross-tenant migration not allowed via this route", 403);
    }

    const report = await runOrderStatusMigration({
      tenantId: targetTenantId,
      dryRun: body.dryRun,
      actorUserId: ctx.userId,
    });
    return jsonOk(report);
  } catch (e) {
    return handleRouteError(e);
  }
}
