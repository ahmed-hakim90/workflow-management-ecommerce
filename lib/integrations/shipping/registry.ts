import { bostaCarrierAdapter } from "@/lib/integrations/shipping/bosta.adapter";
import { fedexCarrierAdapter } from "@/lib/integrations/shipping/fedex.adapter";
import { jntEgyptCarrierAdapter } from "@/lib/integrations/shipping/jnt-egypt.adapter";
import type { ShippingCarrierAdapter } from "@/lib/integrations/shipping/types";
import type { ShippingProvider } from "@/lib/types/models";

const adapters: Record<Exclude<ShippingProvider, "mock">, ShippingCarrierAdapter> = {
  bosta: bostaCarrierAdapter,
  jnt_egypt: jntEgyptCarrierAdapter,
  fedex: fedexCarrierAdapter,
};

export function getShippingCarrierAdapter(provider: ShippingProvider) {
  if (provider === "mock") return null;
  return adapters[provider];
}

export function shippingCarrierLabel(provider: ShippingProvider) {
  switch (provider) {
    case "bosta":
      return "Bosta";
    case "jnt_egypt":
      return "J&T Egypt";
    case "fedex":
      return "FedEx";
    default:
      return "Demo carrier";
  }
}

