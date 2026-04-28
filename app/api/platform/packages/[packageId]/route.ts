import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform-context";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { updatePlatformPackage } from "@/lib/services/platform-packages.service";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().max(500).nullable().optional(),
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
        storefrontOrders: z.boolean().optional(),
        outboundWebhooks: z.boolean().optional(),
      })
      .optional(),
    supportTier: z.enum(["standard", "priority", "dedicated"]).optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: "No fields to update",
  });

type RouteParams = {
  params: Promise<{ packageId: string }>;
};

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    await requirePlatformAdmin(req);
    const { packageId } = await params;
    const body = patchSchema.parse(await req.json());
    const pkg = await updatePlatformPackage({ packageId, ...body });
    return jsonOk({ package: pkg });
  } catch (e) {
    return handleRouteError(e);
  }
}
