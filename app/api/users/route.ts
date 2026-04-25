import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk, jsonError } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { createUser, listUsers, updateUser } from "@/lib/services/users.service";
import type { UserRole } from "@/lib/types/models";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  role: z.enum([
    "admin",
    "moderator",
    "confirmation",
    "invoicing",
    "warehouse",
    "support",
  ]),
  daily_target: z.number().nonnegative().optional(),
});

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
  daily_target: z.number().nonnegative().optional(),
});

export async function GET(req: Request) {
  try {
    const ctx = requireTenant(req);
    assertCan(ctx.role, "user:read");
    const users = await listUsers(ctx.tenantId);
    return jsonOk(users);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = requireTenant(req);
    assertCan(ctx.role, "user:manage");
    const json = await req.json();
    const body = createSchema.parse(json);
    const user = await createUser({
      tenantId: ctx.tenantId,
      name: body.name,
      email: body.email,
      role: body.role as UserRole,
      daily_target: body.daily_target,
      actorUserId: ctx.userId,
    });
    return jsonOk(user);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = requireTenant(req);
    assertCan(ctx.role, "user:manage");
    const json = await req.json();
    const body = patchSchema.parse(json);
    const user = await updateUser({
      tenantId: ctx.tenantId,
      targetUserId: body.targetUserId,
      name: body.name,
      role: body.role as UserRole | undefined,
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
