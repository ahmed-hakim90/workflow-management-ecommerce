import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonError } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import { getShipmentLabel } from "@/lib/services/shipments.service";
import type { ShipmentLabelFormat } from "@/lib/types/models";

function isLabelFormat(value: string | null): value is ShipmentLabelFormat {
  return value === "pdf" || value === "zpl" || value === "thermal";
}

export async function GET(
  req: Request,
  context: { params: Promise<{ shipmentId: string }> },
) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "shipment:read");
    const { shipmentId } = await context.params;
    if (!shipmentId?.trim()) return jsonError("Missing shipment id", 400);
    const url = new URL(req.url);
    const format = url.searchParams.get("format");
    if (format !== null && !isLabelFormat(format)) {
      return jsonError("Invalid label format", 400);
    }
    const label = await getShipmentLabel({
      tenantId: ctx.tenantId,
      shipmentId,
      format: format ?? undefined,
    });
    if (label.url) {
      return Response.redirect(label.url, 302);
    }
    if (!label.data) return jsonError("Label not found", 404);
    const isBase64Pdf = label.contentType === "application/pdf";
    return new Response(
      isBase64Pdf ? Buffer.from(label.data, "base64") : label.data,
      {
        headers: {
          "Content-Type": label.contentType,
          "Content-Disposition": `inline; filename="${shipmentId}.${isBase64Pdf ? "pdf" : "zpl"}"`,
        },
      },
    );
  } catch (e) {
    return handleRouteError(e);
  }
}

