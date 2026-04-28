import { requirePlatformAdmin } from "@/lib/auth/platform-context";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { listPlatformTenantOverviews } from "@/lib/services/platform-tenant-overview.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin(req);
    const companies = await listPlatformTenantOverviews();
    return jsonOk({ companies });
  } catch (e) {
    return handleRouteError(e);
  }
}
