import {
  cancelBostaShipment,
  createBostaShipment,
  trackBostaShipment,
  updateBostaShipment,
} from "@/lib/integrations/bosta";
import type { ShippingCarrierAdapter } from "@/lib/integrations/shipping/types";

export const bostaCarrierAdapter: ShippingCarrierAdapter = {
  provider: "bosta",
  createShipment: createBostaShipment,
  trackShipment: trackBostaShipment,
  cancelShipment: cancelBostaShipment,
  updateShipment: updateBostaShipment,
};

