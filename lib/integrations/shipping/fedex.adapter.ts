import { resolveFedExCredentials } from "@/lib/services/tenant-settings.service";
import type {
  CarrierCreateShipmentInput,
  CarrierTrackingResult,
  ShippingCarrierAdapter,
} from "@/lib/integrations/shipping/types";
import {
  codAmountFromOrder,
  orderDescription,
  pickNumber,
  pickString,
  splitCustomerName,
} from "@/lib/integrations/shipping/utils";
import type { ShipmentLabelFormat } from "@/lib/types/models";

async function fedexToken(tenantId: string) {
  const creds = await resolveFedExCredentials(tenantId);
  if (!creds.clientId || !creds.clientSecret || !creds.accountNumber) {
    throw Object.assign(new Error("FedEx credentials are not configured."), {
      status: 400,
    });
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });
  const res = await fetch(`${creds.baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      pickString(data, ["error_description", "message", "error"]) ??
      `FedEx auth failed with ${res.status}`;
    throw Object.assign(new Error(`FedEx: ${msg}`), {
      status: 502,
      upstreamStatus: res.status,
    });
  }
  const accessToken = pickString(data, ["access_token"]);
  if (!accessToken) throw new Error("FedEx response missing access token");
  return { ...creds, accessToken };
}

async function fedexRequest(input: {
  tenantId: string;
  path: string;
  body: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const creds = await fedexToken(input.tenantId);
  const res = await fetch(`${creds.baseUrl}${input.path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      "Content-Type": "application/json",
      "X-locale": "en_US",
    },
    body: JSON.stringify(input.body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errors = Array.isArray(data.errors) ? data.errors : [];
    const firstError =
      errors[0] && typeof errors[0] === "object"
        ? (errors[0] as Record<string, unknown>)
        : null;
    const msg =
      pickString(firstError, ["message", "code"]) ??
      pickString(data, ["message", "error"]) ??
      `FedEx request failed with ${res.status}`;
    throw Object.assign(new Error(`FedEx: ${msg}`), {
      status: 502,
      upstreamStatus: res.status,
    });
  }
  return data;
}

function fedexLabelType(format: ShipmentLabelFormat | undefined) {
  return format === "zpl" || format === "thermal" ? "ZPLII" : "PDF";
}

function labelFormatFromType(imageType: string): ShipmentLabelFormat {
  return imageType === "ZPLII" ? "zpl" : "pdf";
}

function firstRecordArray(raw: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = raw[key];
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

export const fedexCarrierAdapter: ShippingCarrierAdapter = {
  provider: "fedex",

  async createShipment(input: CarrierCreateShipmentInput) {
    const creds = await resolveFedExCredentials(input.tenantId);
    if (!creds.accountNumber) {
      throw Object.assign(new Error("FedEx account number is not configured."), {
        status: 400,
      });
    }
    const settings = creds.settings;
    const order = input.order;
    const { firstName, lastName } = splitCustomerName(order.customer.name);
    const serviceType =
      input.serviceCode ?? settings.defaultServiceType ?? "INTERNATIONAL_PRIORITY";
    const packagingType = settings.defaultPackagingType ?? "YOUR_PACKAGING";
    const imageType = fedexLabelType(input.labelFormat);
    const description =
      settings.packageDescription?.trim() ||
      orderDescription(order, `Order ${order.wooCommerceOrderId ?? input.shipmentId}`);
    const weight = Number(settings.defaultWeightKg || "1") || 1;
    const length = Math.round(Number(settings.defaultLengthCm || "10") || 10);
    const width = Math.round(Number(settings.defaultWidthCm || "10") || 10);
    const height = Math.round(Number(settings.defaultHeightCm || "10") || 10);
    const recipientStreet = order.customer.address || "Address on file";
    const body = {
      labelResponseOptions: "LABEL",
      requestedShipment: {
        shipDatestamp: new Date().toISOString().slice(0, 10),
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        serviceType,
        packagingType,
        blockInsightVisibility: false,
        shipper: {
          contact: {
            personName: settings.shipperName || "Store",
            phoneNumber: settings.shipperPhone || "01000000000",
          },
          address: {
            streetLines: [settings.shipperStreet || "Warehouse address"],
            city: settings.shipperCity || "Cairo",
            stateOrProvinceCode: settings.shipperStateOrProvinceCode || "",
            postalCode: settings.shipperPostalCode || "00000",
            countryCode: settings.shipperCountryCode || "EG",
          },
        },
        recipients: [
          {
            contact: {
              personName: `${firstName} ${lastName}`.trim(),
              phoneNumber: order.customer.phone || "01000000000",
              emailAddress: order.customer.email || undefined,
            },
            address: {
              streetLines: [recipientStreet.slice(0, 35)],
              city: "Cairo",
              postalCode: "00000",
              countryCode: "EG",
              residential: true,
            },
          },
        ],
        shippingChargesPayment: {
          paymentType: "SENDER",
          payor: {
            responsibleParty: {
              accountNumber: { value: creds.accountNumber },
            },
          },
        },
        labelSpecification: {
          imageType,
          labelStockType: imageType === "ZPLII" ? "STOCK_4X6" : "PAPER_4X6",
        },
        requestedPackageLineItems: [
          {
            weight: { units: "KG", value: weight },
            dimensions: {
              length,
              width,
              height,
              units: "CM",
            },
            itemDescriptionForClearance: description,
            customerReferences: [
              {
                customerReferenceType: "CUSTOMER_REFERENCE",
                value: String(order.wooCommerceOrderId ?? input.shipmentId).slice(0, 30),
              },
            ],
          },
        ],
        totalPackageCount: 1,
      },
      accountNumber: { value: creds.accountNumber },
    };
    const raw = await fedexRequest({
      tenantId: input.tenantId,
      path: "/ship/v1/shipments",
      body,
    });
    const output =
      raw.output && typeof raw.output === "object"
        ? (raw.output as Record<string, unknown>)
        : raw;
    const shipments = firstRecordArray(output, "transactionShipments");
    const shipment = shipments[0] ?? output;
    const packages = firstRecordArray(shipment, "pieceResponses");
    const firstPackage = packages[0] ?? shipment;
    const documents = firstRecordArray(firstPackage, "packageDocuments");
    const doc = documents[0] ?? {};
    const awb =
      pickString(shipment, ["masterTrackingNumber", "trackingNumber"]) ??
      pickString(firstPackage, ["trackingNumber"]);
    if (!awb) throw new Error("FedEx response missing tracking number");
    const encodedLabel = pickString(doc, ["encodedLabel", "parts"]);
    const labelUrl = pickString(doc, ["url", "labelUrl"]);
    const shippingFee =
      pickNumber(shipment, ["shipmentRating", "totalNetCharge"]) ??
      pickNumber(output, ["totalNetCharge", "netCharge"]);
    const labelFormat = labelFormatFromType(imageType);
    return {
      awb,
      provider: "fedex",
      externalId: pickString(shipment, ["shipmentId", "transactionId"]),
      shippingFee,
      carrierTrackingStatus: "created",
      serviceCode: serviceType,
      labelFormat,
      labelUrl: labelFormat === "pdf" ? labelUrl : undefined,
      labelData: labelFormat === "pdf" ? encodedLabel : undefined,
      thermalLabelUrl: labelFormat !== "pdf" ? labelUrl : undefined,
      thermalLabelData: labelFormat !== "pdf" ? encodedLabel : undefined,
      carrierAccountRef: creds.accountNumber,
      rawCarrierStatus: codAmountFromOrder(order) > 0 ? "COD stored in OMS" : undefined,
    };
  },

  async trackShipment(input): Promise<CarrierTrackingResult> {
    const raw = await fedexRequest({
      tenantId: input.tenantId,
      path: "/track/v1/trackingnumbers",
      body: {
        includeDetailedScans: true,
        trackingInfo: [
          {
            trackingNumberInfo: {
              trackingNumber: input.awb,
            },
          },
        ],
      },
    });
    const output =
      raw.output && typeof raw.output === "object"
        ? (raw.output as Record<string, unknown>)
        : raw;
    const completeResults = firstRecordArray(output, "completeTrackResults");
    const trackResults = firstRecordArray(completeResults[0] ?? {}, "trackResults");
    const result = trackResults[0] ?? output;
    const latestStatus =
      result.latestStatusDetail &&
      typeof result.latestStatusDetail === "object" &&
      !Array.isArray(result.latestStatusDetail)
        ? (result.latestStatusDetail as Record<string, unknown>)
        : result;
    return {
      status:
        pickString(latestStatus, ["code", "statusByLocale", "description"]) ??
        "tracking_updated",
      details: pickString(latestStatus, ["statusByLocale", "description"]),
      raw,
    };
  },

  async cancelShipment(input) {
    const creds = await resolveFedExCredentials(input.tenantId);
    if (!creds.accountNumber) {
      throw Object.assign(new Error("FedEx account number is not configured."), {
        status: 400,
      });
    }
    const raw = await fedexRequest({
      tenantId: input.tenantId,
      path: "/ship/v1/shipments/cancel",
      body: {
        accountNumber: { value: creds.accountNumber },
        trackingNumber: input.awb,
        deletionControl: "DELETE_ALL_PACKAGES",
      },
    });
    return { status: "cancelled", details: pickString(raw, ["message"]), raw };
  },
};

