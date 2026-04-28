import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { resolveTicket } from "@/lib/services/tickets.service";

const bodySchema = z.object({
  ticketId: z.string().min(1),
  createExchangeShipment: z.boolean().optional(),
  createShipmentType: z.enum(["return", "exchange"]).optional(),
  resolutionKind: z
    .enum(["resolved", "return", "exchange", "refund_without_shipment"])
    .optional(),
  resolutionDetails: z.string().trim().optional(),
  refundAmount: z.number().nonnegative().optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "ticket:resolve");
    const json = await req.json();
    const {
      ticketId,
      createExchangeShipment,
      createShipmentType,
      resolutionKind,
      resolutionDetails,
      refundAmount,
    } = bodySchema.parse(json);
    const ticket = await resolveTicket({
      tenantId: ctx.tenantId,
      ticketId,
      createExchangeShipment: createExchangeShipment ?? false,
      createShipmentType,
      resolutionKind,
      resolutionDetails,
      refundAmount,
      actorUserId: ctx.userId,
    });
    return jsonOk(ticket);
  } catch (e) {
    return handleRouteError(e);
  }
}
