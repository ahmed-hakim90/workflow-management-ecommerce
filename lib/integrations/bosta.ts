import type { Order, ShipmentType } from "@/lib/types/models";
import { resolveBostaCredentials } from "@/lib/services/tenant-settings.service";

export async function createBostaShipment(input: {
  tenantId: string;
  order: Order;
  type: ShipmentType;
  shipmentId: string;
}): Promise<{
  awb: string;
  provider: "bosta" | "mock";
  externalId?: string;
  /** Quoted / actual fee when available; analytics falls back to `order.shipping.cost`. */
  shippingFee?: number;
}> {
  const fallbackFee = input.order.shipping?.cost ?? 0;
  const { apiKey, baseUrl } = await resolveBostaCredentials(input.tenantId);
  if (!apiKey) {
    return {
      awb: `MOCK-${input.shipmentId.slice(0, 8).toUpperCase()}`,
      provider: "mock",
      shippingFee: fallbackFee,
    };
  }

  // Placeholder for real Bosta HTTP integration
  void baseUrl;
  return {
    awb: `BOSTA-${input.shipmentId.slice(0, 8).toUpperCase()}`,
    provider: "bosta",
    externalId: input.shipmentId,
    shippingFee: fallbackFee,
  };
}
