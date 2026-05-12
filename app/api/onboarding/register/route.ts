import { z } from "zod";
import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { jsonOk, jsonError } from "@/lib/http/json";
import { getRequestClientIp } from "@/lib/http/client-ip";
import { handleRouteError } from "@/lib/http/with-api";
import { registerRateLimitOk } from "@/lib/onboarding/register-rate-limit";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  createTenantRecord,
  setTenantOwner,
} from "@/lib/services/tenants.service";
import { createUser, getUserBySupabaseUserId } from "@/lib/services/users.service";

export const runtime = "nodejs";

const mockBodySchema = z.object({
  companyName: z.string().min(1).max(200),
  adminName: z.string().min(1).max(200),
  email: z.string().email(),
});

const prodBodySchema = z.object({
  companyName: z.string().min(1).max(200),
  adminName: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(6),
});

function registrationSetupError(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  const lower = message.toLowerCase();
  if (
    lower.includes("relation") ||
    lower.includes("does not exist") ||
    lower.includes("schema cache")
  ) {
    const setupErr = new Error(
      "Registration could not finish because the app database is not ready. Apply the Supabase migrations and try again.",
    ) as Error & { status: number };
    setupErr.status = 503;
    return setupErr;
  }
  return err;
}

export async function POST(req: Request) {
  try {
    const ip = getRequestClientIp(req);
    if (!registerRateLimitOk(ip)) {
      return jsonError("Too many registration attempts", 429);
    }

    if (isDevMockDataEnabled()) {
      const body = mockBodySchema.parse(await req.json());
      const mockUid = `mock:${body.email.toLowerCase()}`;
      const existing = await getUserBySupabaseUserId(mockUid);
      if (existing) {
        return jsonError("An account with this email is already registered", 409);
      }
      const tenant = await createTenantRecord(body.companyName);
      const user = await createUser({
        tenantId: tenant.id,
        name: body.adminName,
        email: body.email,
        supabaseUserId: mockUid,
        role: "admin",
        actorUserId: "system:onboarding",
      });
      await setTenantOwner(tenant.id, user.id);
      return jsonOk({
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        userId: user.id,
        staffApiKey: tenant.staffApiKey,
        mode: "mock",
      });
    }

    const body = prodBodySchema.parse(await req.json());
    const supabase = getSupabaseServiceRoleClient();
    const created = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { name: body.adminName },
    });
    if (created.error || !created.data.user) {
      const msg = created.error?.message ?? "Could not create Supabase user";
      return jsonError(msg, msg.toLowerCase().includes("already") ? 409 : 400);
    }

    try {
      const tenant = await createTenantRecord(body.companyName);
      const user = await createUser({
        tenantId: tenant.id,
        name: body.adminName,
        email: body.email,
        supabaseUserId: created.data.user.id,
        role: "admin",
        actorUserId: "system:onboarding",
      });
      await setTenantOwner(tenant.id, user.id);
      return jsonOk({
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        userId: user.id,
        staffApiKey: tenant.staffApiKey,
      });
    } catch (err) {
      await supabase.auth.admin.deleteUser(created.data.user.id).catch(() => undefined);
      throw registrationSetupError(err);
    }
  } catch (e) {
    return handleRouteError(e);
  }
}
