import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk, jsonError } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { listRecentWebhookIngestLogs } from "@/lib/services/webhook-ingest-logs.service";

export const runtime = "nodejs";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:settings");
    assertCan(ctx, "user:manage");
    const url = new URL(req.url);
    const q = querySchema.parse({
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const rows = await listRecentWebhookIngestLogs(
      ctx.tenantId,
      q.limit ?? 30,
    );
    return jsonOk(rows);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST() {
  return jsonError("Method not allowed", 405);
}
