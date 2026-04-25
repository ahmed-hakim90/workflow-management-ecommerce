import type { Order, ShipmentType } from "@/lib/types/models";
import { getServerEnv } from "@/lib/config/env";

export async function createBostaShipment(input: {
  order: Order;
  type: ShipmentType;
  shipmentId: string;
}): Promise<{
  awb: string;
  provider: "bosta" | "mock";
  externalId?: string;
}> {
  const env = getServerEnv();
  if (!env.BOSTA_API_KEY) {
    return {
      awb: `MOCK-${input.shipmentId.slice(0, 8).toUpperCase()}`,
      provider: "mock",
    };
  }

  // Placeholder for real Bosta HTTP integration
  const base = env.BOSTA_BASE_URL ?? "https://app.bosta.co/api/v2";
  void base;
  return {
    awb: `BOSTA-${input.shipmentId.slice(0, 8).toUpperCase()}`,
    provider: "bosta",
    externalId: input.shipmentId,
  };
}
