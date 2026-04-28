import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { getServerEnv } from "@/lib/config/env";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import { getFirebaseAuth } from "@/lib/db/firebase-admin";
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
  ]),
  permissions: z.array(z.string()).optional(),
  daily_target: z.number().nonnegative().optional(),
});

function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

function firebaseAuthErrorCode(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err
    ? String((err as { code?: unknown }).code)
    : "";
}

async function createLinkedFirebaseAccount(body: z.infer<typeof createSchema>) {
  if (!body.password) return undefined;
  if (!body.email) {
    throw httpError("Email is required when creating a login account", 422);
  }

  if (isDevMockDataEnabled()) {
    return `mock:${body.email.toLowerCase()}`;
  }

  const env = getServerEnv();
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) {
    throw httpError("Creating login accounts requires Firebase Admin on the server", 503);
  }

  try {
    const account = await getFirebaseAuth().createUser({
      email: body.email,
      password: body.password,
      displayName: body.name,
      emailVerified: false,
    });
    return account.uid;
  } catch (err) {
    if (firebaseAuthErrorCode(err) === "auth/email-already-exists") {
      throw httpError("A Firebase account with this email already exists", 409);
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
    const firebaseUid = await createLinkedFirebaseAccount(body);
    let user;
    try {
      user = await createUser({
        tenantId: ctx.tenantId,
        name: body.name,
        email: body.email,
        firebaseUid,
        role: body.role as UserRole,
        permissions: normalizePermissionOverrides(body.permissions),
        daily_target: body.daily_target,
        actorUserId: ctx.userId,
      });
    } catch (err) {
      if (firebaseUid && body.password && !isDevMockDataEnabled()) {
        await getFirebaseAuth().deleteUser(firebaseUid).catch(() => undefined);
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
