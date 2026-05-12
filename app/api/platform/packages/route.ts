import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform-context";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import {
  createPlatformPackage,
  listPlatformPackages,
} from "@/lib/services/platform-packages.service";

export const runtime = "nodejs";

const packageSchema = z.object({
  name: z.string().min(1),
  description: z.string().max(500).optional(),
  active: z.boolean().optional(),
  limits: z
    .object({
      maxUsers: z.number().int().nonnegative().optional(),
      maxOrdersPerMonth: z.number().int().nonnegative().optional(),
      maxWebhookEventsPerMonth: z.number().int().nonnegative().optional(),
    })
    .optional(),
  features: z
    .object({
      woocommerce: z.boolean().optional(),
      bosta: z.boolean().optional(),
      jntEgypt: z.boolean().optional(),
      fedex: z.boolean().optional(),
      storefrontOrders: z.boolean().optional(),
      outboundWebhooks: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
    })
    .optional(),
  supportTier: z.enum(["standard", "priority", "dedicated"]).optional(),
});

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin(req);
    const packages = await listPlatformPackages();
    return jsonOk({ packages });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requirePlatformAdmin(req);
    const body = packageSchema.parse(await req.json());
    const pkg = await createPlatformPackage(body);
    return jsonOk({ package: pkg }, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
