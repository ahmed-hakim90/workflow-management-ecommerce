import { z } from "zod";
import { getServerEnv } from "@/lib/config/env";
import { jsonError, jsonOk } from "@/lib/http/json";
import { recordAutomationRun } from "@/lib/services/chat/n8n-automation.service";
import { runAutomationOrderConfirmation } from "@/lib/services/chat/automation-order-confirmation.service";

export const runtime = "nodejs";

/**
 * نقطة دخول اختيارية من n8n — نفس سرّ التشغيل الداخلي.
 * يمكن استخدام `/api/internal/automation/order-confirmation` مباشرة بدلاً منها.
 */
const bodySchema = z.object({
  tenantId: z.string().min(1),
  event: z.string().min(1),
  orderId: z.string().optional(),
  conversationId: z.string().optional(),
  action: z.enum(["confirm", "cancel", "needs_human"]).optional(),
  reason: z.string().optional(),
});

export async function POST(req: Request) {
  const secret = getServerEnv().AUTOMATION_SECRET?.trim();
  if (!secret) {
    return jsonError("Automation not configured", 503);
  }
  const auth = req.headers.get("authorization")?.trim();
  if (auth !== `Bearer ${secret}`) {
    return jsonError("Unauthorized", 401);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(parsed.error.message, 400);
  }

  const b = parsed.data;
  await recordAutomationRun({
    tenantId: b.tenantId,
    eventType: b.event,
    status: "started",
    payloadSummary: {
      orderId: b.orderId,
      conversationId: b.conversationId,
    },
  });

  if (
    b.event === "order.confirmation" &&
    b.action &&
    b.orderId
  ) {
    await runAutomationOrderConfirmation({
      tenantId: b.tenantId,
      orderId: b.orderId,
      action: b.action,
      reason: b.reason,
      conversationId: b.conversationId,
    });
  }

  await recordAutomationRun({
    tenantId: b.tenantId,
    eventType: b.event,
    status: "success",
  });

  return jsonOk({ ok: true });
}
