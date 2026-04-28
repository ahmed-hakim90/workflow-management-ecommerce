import type { Order, ShipmentType } from "@/lib/types/models";
import {
  getTenantIntegrations,
  resolveBostaCredentials,
} from "@/lib/services/tenant-settings.service";

type BostaTrackingResult = {
  status: string;
  details?: string;
  raw?: Record<string, unknown>;
};

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

function bostaTypeForShipment(type: ShipmentType): number {
  switch (type) {
    case "return":
      return 25;
    case "exchange":
      return 30;
    default:
      return 10;
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
  const { apiKey } = await resolveBostaCredentials(input.tenantId);
  if (!apiKey) {
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

  const typeCode = bostaTypeForShipment(input.type);
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
    const created = await bostaHttpRequest({
      tenantId: input.tenantId,
      path: "/deliveries",
      method: "POST",
      body: {
        type: typeCode,
        specs,
        cod,
        dropOffAddress,
        businessReference,
        receiver,
        notes: notes || undefined,
      },
    });
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

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function normalizeBostaTracking(raw: Record<string, unknown>): BostaTrackingResult {
  const status =
    pickString(raw, ["state", "status", "currentStatus", "trackingStatus"]) ??
    "unknown";
  const details =
    pickString(raw, ["message", "description", "reason"]) ??
    (typeof raw?.data === "object" && raw.data
      ? pickString(raw.data as Record<string, unknown>, [
          "state",
          "status",
          "currentStatus",
          "trackingStatus",
        ])
      : undefined);
  return { status, details, raw };
}

async function bostaHttpRequest(input: {
  tenantId: string;
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH";
  body?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const { apiKey, baseUrl } = await resolveBostaCredentials(input.tenantId);
  if (!apiKey || !baseUrl) {
    throw new Error("Bosta credentials are not configured");
  }
  const base = baseUrl.replace(/\/+$/, "");
  const path = input.path.startsWith("/") ? input.path.slice(1) : input.path;
  const res = await fetch(`${base}/api/v0/${path}`, {
    method: input.method ?? "GET",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      "X-Requested-By": "oms",
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      pickString(data, ["message", "error"]) ??
      `Bosta request failed with ${res.status}`;
    const err = new Error(`Bosta: ${message}`);
    (err as Error & { status?: number }).status = 502;
    throw err;
  }
  return data;
}

export async function trackBostaShipment(input: {
  tenantId: string;
  awb: string;
}): Promise<BostaTrackingResult> {
  const { apiKey } = await resolveBostaCredentials(input.tenantId);
  if (!apiKey) {
    return { status: "mock_in_transit", details: "Demo tracking update" };
  }

  const raw = await bostaHttpRequest({
    tenantId: input.tenantId,
    path: `/deliveries/${encodeURIComponent(input.awb)}/tracking`,
  });
  return normalizeBostaTracking(raw);
}

export async function cancelBostaShipment(input: {
  tenantId: string;
  awb: string;
  externalId?: string;
}): Promise<BostaTrackingResult> {
  const { apiKey } = await resolveBostaCredentials(input.tenantId);
  if (!apiKey) {
    return { status: "cancelled", details: "Demo shipment cancelled" };
  }

  const target = input.externalId ?? input.awb;
  const raw = await bostaHttpRequest({
    tenantId: input.tenantId,
    path: `/deliveries/${encodeURIComponent(target)}/cancel`,
    method: "POST",
  });
  return normalizeBostaTracking({ ...raw, status: "cancelled" });
}
