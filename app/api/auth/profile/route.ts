import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { jsonOk, jsonError } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { updateUser } from "@/lib/services/users.service";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

export const runtime = "nodejs";

const patchSchema = z.object({
  firstName: z.string().optional().default(""),
  lastName: z.string().optional().default(""),
  language: z.enum(SUPPORTED_LOCALES).optional(),
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
      language: body.language,
      actorUserId: ctx.userId,
    });
    return jsonOk({ name: user.name, language: user.language ?? "en" });
  } catch (e) {
    return handleRouteError(e);
  }
}

/** Intentional: profile display fields load via `GET /api/auth/me` in the client (see `loadSessionFromIdToken`). */
export async function GET() {
  return jsonError("Method not allowed", 405);
}
