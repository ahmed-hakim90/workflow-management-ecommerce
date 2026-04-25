import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import {
  getKanbanSettings,
  setKanbanSettings,
} from "@/lib/services/kanban-settings.service";
import type { KanbanCardField, OrderStatus } from "@/lib/types/models";

const orderStatusZ = z.enum([
  "pending_confirmation",
  "confirmed",
  "invoicing",
  "ready_for_warehouse",
  "packed",
  "shipped",
  "delivered",
  "follow_up",
  "cancelled",
]);

const cardFieldZ = z.enum([
  "customer",
  "total",
  "payment",
  "status",
  "assigned",
  "woo",
]);

const bodySchema = z.object({
  columns: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      statuses: z.array(orderStatusZ).min(1),
      cardFields: z.array(cardFieldZ).optional(),
    }),
  ),
});

export async function GET(req: Request) {
  try {
    const ctx = requireTenant(req);
    assertCan(ctx.role, "order:read");
    const settings = await getKanbanSettings(ctx.tenantId);
    return jsonOk(settings);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = requireTenant(req);
    assertCan(ctx.role, "user:manage");
    const json = await req.json();
    const parsed = bodySchema.parse(json);
    await setKanbanSettings(ctx.tenantId, {
      columns: parsed.columns.map((c) => ({
        id: c.id,
        title: c.title,
        statuses: c.statuses as OrderStatus[],
        cardFields: c.cardFields as KanbanCardField[] | undefined,
      })),
    });
    const next = await getKanbanSettings(ctx.tenantId);
    return jsonOk(next);
  } catch (e) {
    return handleRouteError(e);
  }
}
