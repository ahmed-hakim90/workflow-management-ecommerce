import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { jsonOk, jsonError } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { updateUser } from "@/lib/services/users.service";

export const runtime = "nodejs";

const patchSchema = z.object({
  firstName: z.string().optional().default(""),
  lastName: z.string().optional().default(""),
});

/** Current user can update their own display name (no `user:manage` required). */
export async function PATCH(req: Request) {
  try {
    const ctx = await requireTenant(req);
    const json = await req.json();
    const body = patchSchema.parse(json);
    const name = [body.firstName.trim(), body.lastName.trim()]
      .filter(Boolean)
      .join(" ");
    if (!name) {
      return jsonError("Name cannot be empty", 400);
    }
    const user = await updateUser({
      tenantId: ctx.tenantId,
      targetUserId: ctx.userId,
      name,
      actorUserId: ctx.userId,
    });
    return jsonOk({ name: user.name });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function GET() {
  return jsonError("Method not allowed", 405);
}
