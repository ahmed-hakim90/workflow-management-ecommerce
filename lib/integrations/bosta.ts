import type { Order, ShipmentType } from "@/lib/types/models";
import {
  getTenantIntegrations,
  resolveBostaCredentials,
} from "@/lib/services/tenant-settings.service";

type BostaClientConstructor = new (
  apiKey: string,
  baseUrl?: string,
) => {
  deliveryTypes: {
    SEND: { code: number };
    RTO: { code: number };
    EXCHANGE: { code: number };
  };
  delivery: {
    createDelivery: (
      type: number,
      specs: Record<string, unknown>,
      cod: number,
      dropOffAddress: Record<string, unknown>,
      businessReference: string,
      receiver: Record<string, unknown>,
      notes: string,
    ) => Promise<{ _id?: string; trackingNumber?: string }>;
  };
};

type BostaClient = InstanceType<BostaClientConstructor>;

let bostaConstructorPromise:
  | Promise<BostaClientConstructor | null>
  | undefined;

async function loadBostaConstructor(): Promise<BostaClientConstructor | null> {
  if (!bostaConstructorPromise) {
    bostaConstructorPromise = import("bosta")
      .then((mod) => (mod.default ?? mod) as BostaClientConstructor)
      .catch(() => null);
  }
  return bostaConstructorPromise;
}

function splitCustomerName(name: string): { firstName: string; lastName: string } {
  const t = name.trim() || "Customer";
  const i = t.indexOf(" ");
  if (i === -1) return { firstName: t, lastName: "." };
  return { firstName: t.slice(0, i), lastName: t.slice(i + 1).trim() || "." };
}

function codAmountFromOrder(order: Order): number {
  const p = order.payment;
  if (p.payment_status === "cod") {
    return Math.max(0, Math.round(p.cod_amount || p.remaining_amount || 0));
  }
  return 0;
}

function bostaTypeForShipment(client: BostaClient, type: ShipmentType): number {
  const t = client.deliveryTypes;
  switch (type) {
    case "return":
      return t.RTO.code;
    case "exchange":
      return t.EXCHANGE.code;
    default:
      return t.SEND.code;
  }
}

export async function createBostaShipment(input: {
  tenantId: string;
  order: Order;
  type: ShipmentType;
  shipmentId: string;
}): Promise<{
  awb: string;
  provider: "bosta" | "mock";
  externalId?: string;
  shippingFee?: number;
}> {
  const fallbackFee = input.order.shipping?.cost ?? 0;
  const { apiKey, baseUrl } = await resolveBostaCredentials(input.tenantId);
  const BostaConstructor = await loadBostaConstructor();
  if (!apiKey || !BostaConstructor) {
    return {
      awb: `MOCK-${input.shipmentId.slice(0, 8).toUpperCase()}`,
      provider: "mock",
      shippingFee: fallbackFee,
    };
  }

  const integrations = await getTenantIntegrations(input.tenantId);
  const b = integrations.bosta ?? {};
  const city = b.defaultCityId?.trim();
  if (!city) {
    const err = new Error(
      "Bosta: set default city code (e.g. EG-01) in Settings → API keys.",
    );
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  const zone = b.defaultZoneId?.trim() || "General";
  const buildingNumber =
    Number.parseInt(String(b.defaultBuildingNumber ?? "1"), 10) || 1;
  const firstLine = (
    input.order.customer.address?.trim() ||
    b.defaultAddressLine?.trim() ||
    "Address on file"
  ).slice(0, 200);
  const itemCount =
    input.order.lineItems?.reduce((s, li) => s + li.quantity, 0) ?? 1;
  const desc = (
    b.packageDescription?.trim() ||
    `Order ${input.order.wooCommerceOrderId ?? input.shipmentId.slice(0, 8)}`
  ).slice(0, 200);

  const client = new BostaConstructor(apiKey, baseUrl);
  const typeCode = bostaTypeForShipment(client, input.type);
  const specs = {
    packageType: "Parcel",
    size: "SMALL",
    packageDetails: {
      itemsCount: Math.max(1, itemCount),
      description: desc,
    },
  };

  const dropOffAddress = {
    buildingNumber,
    firstLine,
    city,
    zone,
  };

  const { firstName, lastName } = splitCustomerName(input.order.customer.name);
  const phone = (input.order.customer.phone ?? "").trim() || "01000000000";
  const receiver: Record<string, unknown> = {
    firstName: firstName.slice(0, 80),
    lastName: lastName.slice(0, 80),
    phone,
  };
  if (input.order.customer.email?.trim()) {
    receiver.email = input.order.customer.email.trim();
  }

  const cod = codAmountFromOrder(input.order);
  const businessReference = String(
    input.order.wooCommerceOrderId ?? input.shipmentId,
  );
  const notes = (input.order.notes ?? "").slice(0, 500);

  try {
    const created = await client.delivery.createDelivery(
      typeCode,
      specs,
      cod,
      dropOffAddress,
      businessReference,
      receiver,
      notes,
    );
    const trackingNumber = created?.trackingNumber;
    if (!trackingNumber) {
      throw new Error("Bosta response missing trackingNumber");
    }
    return {
      awb: String(trackingNumber),
      provider: "bosta",
      externalId: created?._id ? String(created._id) : undefined,
      shippingFee: fallbackFee,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const err = new Error(`Bosta: ${msg}`);
    (err as Error & { status?: number }).status = 502;
    throw err;
  }
}
