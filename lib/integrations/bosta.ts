import type { Order, ShipmentType } from "@/lib/types/models";
import {
  getTenantIntegrations,
  resolveBostaCredentials,
} from "@/lib/services/tenant-settings.service";

type BostaTrackingResult = {
  status: string;
  details?: string;
  shippingFee?: number;
  raw?: Record<string, unknown>;
};

export type BostaLocationOption = {
  id: string;
  name: string;
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
  actorUserId?: string;
  actorUserName?: string;
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
      "Bosta: choose the warehouse city in Settings → API keys.",
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
    fullName: input.order.customer.name.slice(0, 160),
    firstName: firstName.slice(0, 80),
    lastName: lastName.slice(0, 80),
    phone,
  };
  if (input.order.customer.email?.trim()) {
    receiver.email = input.order.customer.email.trim();
  }
  if (input.order.customer.address?.trim()) {
    receiver.address = input.order.customer.address.trim().slice(0, 300);
  }

  const cod = codAmountFromOrder(input.order);
  const businessReference = String(
    input.order.wooCommerceOrderId ?? input.shipmentId,
  );
  const notes = [
    input.order.notes?.trim(),
    orderAddressNotes(input.order),
    input.actorUserName || input.actorUserId
      ? `Created by: ${input.actorUserName ?? input.actorUserId}`
      : undefined,
  ]
    .filter((p): p is string => Boolean(p))
    .join(" | ")
    .slice(0, 500);

  try {
    const rawCreated = await bostaHttpRequest({
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
    const created = unwrapBostaObject(rawCreated);
    const trackingNumber = created?.trackingNumber;
    if (!trackingNumber) {
      throw new Error("Bosta response missing trackingNumber");
    }
    return {
      awb: String(trackingNumber),
      provider: "bosta",
      externalId: created?._id ? String(created._id) : undefined,
      shippingFee: extractShippingFee(rawCreated) ?? fallbackFee,
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

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function nestedRecord(obj: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = obj[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function unwrapBostaObject(raw: Record<string, unknown>): Record<string, unknown> {
  const data = nestedRecord(raw, "data");
  if (data && (data.trackingNumber || data._id || data.delivery || data.shipment)) {
    return data;
  }
  const message = nestedRecord(raw, "message");
  if (message && (message.trackingNumber || message._id)) return message;
  return raw;
}

function extractShippingFee(raw: Record<string, unknown>): number | undefined {
  const direct = pickNumber(raw, [
    "shippingFee",
    "shippingFees",
    "shipping_fees",
    "deliveryFee",
    "deliveryFees",
    "carrierFee",
    "carrierFees",
    "fees",
    "fee",
    "price",
    "amount",
    "total",
  ]);
  if (direct !== undefined) return direct;
  for (const key of ["data", "message", "delivery", "shipment", "pricing"]) {
    const nested = nestedRecord(raw, key);
    if (!nested) continue;
    const fee = extractShippingFee(nested);
    if (fee !== undefined) return fee;
  }
  return undefined;
}

function orderAddressNotes(order: Order): string | undefined {
  const parts = [
    order.customer.address,
    order.customer.email ? `Email: ${order.customer.email}` : undefined,
    order.customer.phone ? `Phone: ${order.customer.phone}` : undefined,
  ]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p));
  return parts.length ? parts.join(" | ") : undefined;
}

function pickArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["data", "cities", "zones", "items", "results"]) {
      if (Array.isArray(obj[key])) return obj[key];
    }
  }
  return [];
}

function normalizeLocationOption(raw: unknown): BostaLocationOption | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id =
    pickString(obj, ["_id", "id", "cityId", "zoneId", "code"]) ??
    (typeof obj.id === "number" ? String(obj.id) : undefined);
  const name = pickString(obj, [
    "name",
    "nameAr",
    "nameEn",
    "cityName",
    "zoneName",
    "label",
    "title",
  ]);
  if (!id || !name) return null;
  return { id, name };
}

function normalizeLocationOptions(raw: unknown): BostaLocationOption[] {
  const seen = new Set<string>();
  const out: BostaLocationOption[] = [];
  for (const item of pickArray(raw)) {
    const option = normalizeLocationOption(item);
    if (!option || seen.has(option.id)) continue;
    seen.add(option.id);
    out.push(option);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeBostaTracking(raw: Record<string, unknown>): BostaTrackingResult {
  const data = nestedRecord(raw, "data");
  const source = data ?? raw;
  const status =
    pickString(source, ["state", "status", "currentStatus", "trackingStatus"]) ??
    "unknown";
  const details =
    pickString(source, ["message", "description", "reason"]) ??
    (typeof raw?.data === "object" && raw.data
      ? pickString(raw.data as Record<string, unknown>, [
          "state",
          "status",
          "currentStatus",
          "trackingStatus",
        ])
      : undefined);
  return { status, details, shippingFee: extractShippingFee(raw), raw };
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

export async function listBostaCities(
  tenantId: string,
): Promise<BostaLocationOption[]> {
  const raw = await bostaHttpRequest({ tenantId, path: "/cities" });
  return normalizeLocationOptions(raw);
}

export async function listBostaZones(
  tenantId: string,
  cityId: string,
): Promise<BostaLocationOption[]> {
  const id = cityId.trim();
  if (!id) return [];
  const raw = await bostaHttpRequest({
    tenantId,
    path: `/zones?cityId=${encodeURIComponent(id)}`,
  });
  return normalizeLocationOptions(raw);
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
