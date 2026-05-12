import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { N8N_OMS_EVENT_IDS } from "@/lib/constants/n8n-oms-events";
import {
  createMessageTemplate,
  isMessageTemplateVisibleInInbox,
  listMessageTemplates,
  seedDefaultQuickRepliesIfEmpty,
} from "@/lib/services/chat/message-templates.service";

const EVENT_KEYS = [
  "order_confirm",
  "ask_address",
  "shipped",
  "delivery_failed",
  "return",
  "complaint",
] as const;

const postSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
  whatsappTemplateName: z.string().max(200).nullable().optional(),
  eventKey: z.enum(EVENT_KEYS).nullable().optional(),
  category: z.string().max(64).nullable().optional(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  linkedOmsEvent: z.enum(N8N_OMS_EVENT_IDS).nullable().optional(),
});

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "inbox:read");
    const url = new URL(req.url);
    const all = url.searchParams.get("all") === "1";
    if (all) {
      assertCan(ctx, "inbox:manage");
    }
    await seedDefaultQuickRepliesIfEmpty(ctx.tenantId);
    let list = await listMessageTemplates(ctx.tenantId);
    if (!all) {
      list = list.filter(isMessageTemplateVisibleInInbox);
    }
    return jsonOk(list);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "inbox:manage");
    const json = await req.json();
    const body = postSchema.parse(json);
    const created = await createMessageTemplate(ctx.tenantId, body);
    return jsonOk(created);
  } catch (e) {
    return handleRouteError(e);
  }
}
