import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { N8N_OMS_EVENT_IDS } from "@/lib/constants/n8n-oms-events";
import {
  deleteMessageTemplate,
  getMessageTemplate,
  updateMessageTemplate,
} from "@/lib/services/chat/message-templates.service";

const EVENT_KEYS = [
  "order_confirm",
  "ask_address",
  "shipped",
  "delivery_failed",
  "return",
  "complaint",
] as const;

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    body: z.string().min(1).max(8000).optional(),
    whatsappTemplateName: z.string().max(200).nullable().optional(),
    eventKey: z.enum(EVENT_KEYS).nullable().optional(),
    category: z.string().max(64).nullable().optional(),
    approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
    linkedOmsEvent: z.enum(N8N_OMS_EVENT_IDS).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field" });

export async function GET(
  req: Request,
  routeCtx: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "inbox:manage");
    const { id } = await routeCtx.params;
    const row = await getMessageTemplate(ctx.tenantId, id);
    if (!row) {
      const err = new Error("Not found") as Error & { status: number };
      err.status = 404;
      throw err;
    }
    return jsonOk(row);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(
  req: Request,
  routeCtx: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "inbox:manage");
    const { id } = await routeCtx.params;
    const json = await req.json();
    const body = patchSchema.parse(json);
    const next = await updateMessageTemplate(ctx.tenantId, id, body);
    if (!next) {
      const err = new Error("Not found") as Error & { status: number };
      err.status = 404;
      throw err;
    }
    return jsonOk(next);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(
  req: Request,
  routeCtx: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "inbox:manage");
    const { id } = await routeCtx.params;
    const ok = await deleteMessageTemplate(ctx.tenantId, id);
    if (!ok) {
      const err = new Error("Not found") as Error & { status: number };
      err.status = 404;
      throw err;
    }
    return jsonOk({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
