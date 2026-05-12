import type {
  Order,
  ShipmentLabelFormat,
  ShipmentType,
  ShippingProvider,
} from "@/lib/types/models";

export type CarrierTrackingResult = {
  status: string;
  details?: string;
  shippingFee?: number;
  raw?: Record<string, unknown>;
};

export type CarrierCreateResult = {
  awb: string;
  provider: ShippingProvider;
  externalId?: string;
  shippingFee?: number;
  carrierTrackingStatus?: string;
  serviceCode?: string;
  labelFormat?: ShipmentLabelFormat;
  labelUrl?: string;
  labelData?: string;
  thermalLabelUrl?: string;
  thermalLabelData?: string;
  carrierAccountRef?: string;
  rawCarrierStatus?: string;
};

export type CarrierShipmentEditInput = {
  codAmount?: number;
  allowOpening?: boolean;
  notes?: string;
};

export type CarrierCreateShipmentInput = {
  tenantId: string;
  order: Order;
  type: ShipmentType;
  shipmentId: string;
  actorUserId?: string;
  actorUserName?: string;
  serviceCode?: string;
  labelFormat?: ShipmentLabelFormat;
};

export type CarrierShipmentReference = {
  tenantId: string;
  awb: string;
  externalId?: string;
  serviceCode?: string;
};

export type CarrierLabelResult = {
  format: ShipmentLabelFormat;
  contentType: string;
  data?: string;
  url?: string;
};

export type ShippingCarrierAdapter = {
  provider: Exclude<ShippingProvider, "mock">;
  createShipment(input: CarrierCreateShipmentInput): Promise<CarrierCreateResult>;
  trackShipment(input: CarrierShipmentReference): Promise<CarrierTrackingResult>;
  cancelShipment(input: CarrierShipmentReference): Promise<CarrierTrackingResult>;
  updateShipment?(
    input: CarrierShipmentReference & { changes: CarrierShipmentEditInput },
  ): Promise<CarrierTrackingResult>;
  getLabel?(
    input: CarrierShipmentReference & { format: ShipmentLabelFormat },
  ): Promise<CarrierLabelResult | null>;
};

export function isShippingProvider(value: unknown): value is ShippingProvider {
  return (
    value === "bosta" ||
    value === "jnt_egypt" ||
    value === "fedex" ||
    value === "mock"
  );
}

