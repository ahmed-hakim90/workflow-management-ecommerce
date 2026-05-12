import { z } from "zod";
import { getServerEnv } from "@/lib/config/env";
import { jsonError, jsonOk } from "@/lib/http/json";
import { runAutomationOrderConfirmation } from "@/lib/services/chat/automation-order-confirmation.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  tenantId: z.string().min(1),
  orderId: z.string().min(1),
  action: z.enum(["confirm", "cancel", "needs_human"]),
  reason: z.string().max(2000).optional(),
  conversationId: z.string().optional(),
});

function unauthorized() {
  return jsonError("Unauthorized", 401);
}

export async function POST(req: Request) {
  const secret = getServerEnv().AUTOMATION_SECRET?.trim();
  if (!secret) {
    return jsonError("Automation not configured", 503);
  }
  const auth = req.headers.get("authorization")?.trim();
  if (auth !== `Bearer ${secret}`) {
    return unauthorized();
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

  await runAutomationOrderConfirmation(parsed.data);
  return jsonOk({ ok: true });
}
