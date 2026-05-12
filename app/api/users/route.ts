import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { jsonOk, jsonError } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { normalizePermissionOverrides } from "@/lib/auth/rbac";
import { createUser, listUsers, updateUser } from "@/lib/services/users.service";
import { assertTenantCanCreateUser } from "@/lib/services/platform-packages.service";
import type { UserRole } from "@/lib/types/models";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum([
    "admin",
    "moderator",
    "confirmation",
    "invoicing",
    "warehouse",
    "support",
    "viewer",
  ]),
  permissions: z.array(z.string()).optional(),
  daily_target: z.number().nonnegative().optional(),
});

function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

function supabaseAuthErrorMessage(err: unknown) {
  return typeof err === "object" && err !== null && "message" in err
    ? String((err as { message?: unknown }).message)
    : "";
}

async function createLinkedSupabaseAccount(body: z.infer<typeof createSchema>) {
  if (!body.password) return undefined;
  if (!body.email) {
    throw httpError("Email is required when creating a login account", 422);
  }

  if (isDevMockDataEnabled()) {
    return `mock:${body.email.toLowerCase()}`;
  }

  try {
    const { data, error } = await getSupabaseServiceRoleClient().auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { name: body.name },
    });
    if (error) throw error;
    return data.user.id;
  } catch (err) {
    if (supabaseAuthErrorMessage(err).toLowerCase().includes("already")) {
      throw httpError("A Supabase account with this email already exists", 409);
    }
    throw err;
  }
}

const patchSchema = z.object({
  targetUserId: z.string().min(1),
  name: z.string().min(1).optional(),
  role: z
    .enum([
      "admin",
      "moderator",
      "confirmation",
      "invoicing",
      "warehouse",
      "support",
      "viewer",
    ])
    .optional(),
  permissions: z.array(z.string()).optional(),
  daily_target: z.number().nonnegative().optional(),
});

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:users");
    assertCan(ctx, "user:read");
    const users = await listUsers(ctx.tenantId);
    return jsonOk(users);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "user:manage");
    const json = await req.json();
    const body = createSchema.parse(json);
    await assertTenantCanCreateUser(ctx.tenantId);
    const supabaseUserId = await createLinkedSupabaseAccount(body);
    let user;
    try {
      user = await createUser({
        tenantId: ctx.tenantId,
        name: body.name,
        email: body.email,
        supabaseUserId,
        role: body.role as UserRole,
        permissions: normalizePermissionOverrides(body.permissions),
        daily_target: body.daily_target,
        actorUserId: ctx.userId,
      });
    } catch (err) {
      if (supabaseUserId && body.password && !isDevMockDataEnabled()) {
        await getSupabaseServiceRoleClient()
          .auth.admin.deleteUser(supabaseUserId)
          .catch(() => undefined);
      }
      throw err;
    }
    return jsonOk(user);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "user:manage");
    const json = await req.json();
    const body = patchSchema.parse(json);
    const user = await updateUser({
      tenantId: ctx.tenantId,
      targetUserId: body.targetUserId,
      name: body.name,
      role: body.role as UserRole | undefined,
      permissions:
        body.permissions !== undefined
          ? normalizePermissionOverrides(body.permissions)
          : undefined,
      daily_target: body.daily_target,
      actorUserId: ctx.userId,
    });
    return jsonOk(user);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PUT() {
  return jsonError("Method not allowed", 405);
}
