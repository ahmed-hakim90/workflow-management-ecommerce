import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import {
  getTenantAutomation,
  setTenantAutomation,
} from "@/lib/services/tenant-settings.service";

const patchSchema = z
  .object({
    auto_create_shipment: z.boolean().optional(),
    create_shipment_stage: z.enum(["confirmed", "invoiced"]).optional(),
    whatsappMessageTemplate: z.string().min(1).max(2000).nullable().optional(),
    orderLinkTemplate: z.string().max(1000).nullable().optional(),
    whatsappAutomationEnabled: z.boolean().optional(),
    n8nWebhookUrl: z.string().url().max(2000).nullable().optional(),
    n8nWebhookSecret: z.string().min(8).max(500).nullable().optional(),
    orderConfirmationTemplateName: z.string().max(200).nullable().optional(),
    orderConfirmationTemplateLanguage: z.string().max(20).nullable().optional(),
    inlineReplyClassifier: z.boolean().optional(),
    inboxSlaFirstResponseMinutes: z.number().int().min(0).max(10080).optional(),
    inboxSlaCustomerIdleHours: z.number().int().min(0).max(720).optional(),
    inboxSlaInternalActionHours: z.number().int().min(0).max(720).optional(),
    replyIntentClassifierProvider: z
      .enum(["heuristic", "openrouter", "ollama", "hybrid"])
      .optional(),
    replyIntentClassifierLlmThreshold: z.number().min(0).max(1).optional(),
  })
  .refine(
    (d) =>
      d.auto_create_shipment !== undefined ||
      d.create_shipment_stage !== undefined ||
      d.whatsappMessageTemplate !== undefined ||
      d.orderLinkTemplate !== undefined ||
      d.whatsappAutomationEnabled !== undefined ||
      d.n8nWebhookUrl !== undefined ||
      d.n8nWebhookSecret !== undefined ||
      d.orderConfirmationTemplateName !== undefined ||
      d.orderConfirmationTemplateLanguage !== undefined ||
      d.inlineReplyClassifier !== undefined ||
      d.inboxSlaFirstResponseMinutes !== undefined ||
      d.inboxSlaCustomerIdleHours !== undefined ||
      d.inboxSlaInternalActionHours !== undefined ||
      d.replyIntentClassifierProvider !== undefined ||
      d.replyIntentClassifierLlmThreshold !== undefined,
    { message: "At least one field is required" },
  );

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:settings");
    assertCan(ctx, "user:manage");
    const automation = await getTenantAutomation(ctx.tenantId);
    return jsonOk(automation);
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "page:settings");
    assertCan(ctx, "user:manage");
    const json = await req.json();
    const body = patchSchema.parse(json);
    await setTenantAutomation(ctx.tenantId, body);
    const next = await getTenantAutomation(ctx.tenantId);
    return jsonOk(next);
  } catch (e) {
    return handleRouteError(e);
  }
}
