import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan, type Permission } from "@/lib/auth/rbac";
import { jsonOk, jsonError } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import {
  transitionOrder,
  TransitionBlockedError,
  getOrder,
} from "@/lib/services/orders.service";
import {
  ORDER_ACTIONS,
  type OrderActionId,
  assertActionAllowed,
} from "@/lib/logic/order-actions";
import type { OrderStatus, UserRole } from "@/lib/types/models";

const ALL_STATUSES = [
  "new",
  "pending_confirmation",
  "confirmed",
  "cancelled",
  "invoice_required",
  "invoiced",
  "ready_for_shipping",
  "awb_created",
  "warehouse_picking",
  "warehouse_packed",
  "out_for_shipping",
  "delivered",
  "failed_delivery",
  "returned",
  "exchange_requested",
  "replacement_created",
  "closed",
] as const satisfies readonly OrderStatus[];

const ACTION_IDS = ORDER_ACTIONS.map((a) => a.id) as [
  OrderActionId,
  ...OrderActionId[],
];

/**
 * POST /api/orders/transition
 *
 * Two flavors are accepted:
 *  - `{ orderId, actionId, note? }` — preferred. Resolves to the action's
 *    target status and uses RBAC permission of that action.
 *  - `{ orderId, toStatus, note? }` — direct status change (drag-drop).
 *    The caller must have the per-action permission inferred from the catalogue.
 */
const bodySchema = z
  .object({
    orderId: z.string().min(1),
    actionId: z.enum(ACTION_IDS).optional(),
    toStatus: z.enum(ALL_STATUSES).optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .refine(
    (b) => !!b.actionId || !!b.toStatus,
    "actionId or toStatus is required",
  );

function inferAction(toStatus: OrderStatus): OrderActionId | undefined {
  return ORDER_ACTIONS.find((a) => a.toStatus === toStatus)?.id;
}

function permissionForAction(actionId: OrderActionId | undefined): Permission {
  if (!actionId) return "order:read";
  return (
    ORDER_ACTIONS.find((a) => a.id === actionId)?.permission ?? "order:read"
  );
}

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    const json = await req.json();
    const body = bodySchema.parse(json);

    // We always need at least order:read to call this endpoint.
    assertCan(ctx, "order:read");

    const order = await getOrder(ctx.tenantId, body.orderId);
    if (!order) return jsonError("Order not found", 404);

    const actionId = body.actionId ?? inferAction(body.toStatus as OrderStatus);
    if (!actionId) {
      return jsonError("No action maps to that target status", 400);
    }
    const action = ORDER_ACTIONS.find((a) => a.id === actionId);
    if (!action) return jsonError("Unknown action", 400);

    assertCan(ctx, permissionForAction(actionId));
    assertActionAllowed(order, actionId, ctx);

    if (action.requiresNote && !body.note?.trim()) {
      return jsonError("Note is required for this action", 400);
    }

    const next = await transitionOrder({
      tenantId: ctx.tenantId,
      orderId: body.orderId,
      toStatus: action.toStatus,
      actorUserId: ctx.userId,
      role: ctx.role as UserRole,
      note: body.note,
    });
    return jsonOk(next);
  } catch (e) {
    if (e instanceof TransitionBlockedError) {
      return jsonError(
        e.message,
        422,
        {
          reason: e.reason,
          from: e.from,
          to: e.to,
          missingInvoice: e.reason === "missing_invoice",
          missingAwb: e.reason === "missing_awb",
        },
      );
    }
    return handleRouteError(e);
  }
}
