import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { addTicketNote } from "@/lib/services/tickets.service";

const bodySchema = z.object({
  body: z.string().trim().min(2, "Note is required"),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ ticketId: string }> },
) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "ticket:resolve");
    const { ticketId } = await context.params;
    if (!ticketId?.trim()) return jsonError("Missing ticket id", 400);
    const json = await req.json();
    const { body } = bodySchema.parse(json);
    const ticket = await addTicketNote({
      tenantId: ctx.tenantId,
      ticketId,
      body,
      actorUserId: ctx.userId,
    });
    return jsonOk(ticket);
  } catch (e) {
    return handleRouteError(e);
  }
}
