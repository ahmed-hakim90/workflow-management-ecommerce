import {
  resolveJntEgyptCredentials,
} from "@/lib/services/tenant-settings.service";
import { createHash } from "node:crypto";
import type {
  CarrierCreateShipmentInput,
  CarrierLabelResult,
  ShippingCarrierAdapter,
} from "@/lib/integrations/shipping/types";
import {
  codAmountFromOrder,
  orderDescription,
  orderItemCount,
  pickString,
  splitCustomerName,
} from "@/lib/integrations/shipping/utils";

const ENDPOINTS = {
  createOrder: "/webopenplatformapi/api/order/addOrder",
  cancelOrder: "/webopenplatformapi/api/order/cancelOrder",
  trackOrder: "/webopenplatformapi/api/logistics/trace",
  printOrder: "/webopenplatformapi/api/order/printOrder",
};

function md5Base64(input: string) {
  return Buffer.from(
    createHash("md5").update(input, "utf8").digest(),
  ).toString("base64");
}

function stringifyBizContent(body: Record<string, unknown>) {
  return JSON.stringify(body);
}

async function jntRequest(input: {
  tenantId: string;
  endpoint: keyof typeof ENDPOINTS;
  body: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const creds = await resolveJntEgyptCredentials(input.tenantId);
  if (!creds.apiAccount || !creds.customerCode || !creds.customerPassword || !creds.privateKey) {
    throw Object.assign(
      new Error("J&T Egypt credentials are not configured."),
      { status: 400 },
    );
  }
  const bizContent = stringifyBizContent(input.body);
  const timestamp = String(Date.now());
  const digest = md5Base64(`${bizContent}${creds.privateKey}`);
  const form = new URLSearchParams({ bizContent });
  const res = await fetch(`${creds.baseUrl}${ENDPOINTS[input.endpoint]}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      apiAccount: creds.apiAccount,
      digest,
      timestamp,
    },
    body: form.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const okCode = data.code === "1" || data.code === 1 || data.success === true;
  if (!res.ok || !okCode) {
    const msg =
      pickString(data, ["msg", "message", "error"]) ??
      `J&T Egypt request failed with ${res.status}`;
    const err = new Error(`J&T Egypt: ${msg}`);
    (err as Error & { status?: number; upstreamStatus?: number }).status = 502;
    (err as Error & { status?: number; upstreamStatus?: number }).upstreamStatus =
      res.status;
    throw err;
  }
  return data;
}

async function baseJntBody(tenantId: string) {
  const creds = await resolveJntEgyptCredentials(tenantId);
  if (!creds.customerCode || !creds.customerPassword || !creds.privateKey) {
    throw Object.assign(
      new Error("J&T Egypt credentials are not configured."),
      { status: 400 },
    );
  }
  return {
    customerCode: creds.customerCode,
    digest: md5Base64(`${creds.customerCode}${creds.customerPassword}${creds.privateKey}`),
    settings: creds.settings,
  };
}

function readData(raw: Record<string, unknown>): Record<string, unknown> {
  const data = raw.data;
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : raw;
}

async function getJntLabel(input: {
  tenantId: string;
  awb: string;
  format: "pdf" | "zpl" | "thermal";
}): Promise<CarrierLabelResult | null> {
  const { customerCode, digest } = await baseJntBody(input.tenantId);
  const printSize = input.format === "pdf" ? "0" : "2";
  const raw = await jntRequest({
    tenantId: input.tenantId,
    endpoint: "printOrder",
    body: {
      customerCode,
      digest,
      billCode: input.awb,
      printSize,
      printCode: 1,
    },
  });
  const data = readData(raw);
  const url = pickString(data, ["url", "pdfUrl", "labelUrl"]);
  const labelData = pickString(data, ["base64", "label", "labelData"]);
  return {
    format: input.format,
    contentType: input.format === "pdf" ? "application/pdf" : "text/plain",
    url,
    data: labelData,
  };
}

function numericSetting(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const jntEgyptCarrierAdapter: ShippingCarrierAdapter = {
  provider: "jnt_egypt",

  async createShipment(input: CarrierCreateShipmentInput) {
    const { customerCode, digest, settings } = await baseJntBody(input.tenantId);
    const order = input.order;
    const { firstName, lastName } = splitCustomerName(order.customer.name);
    const txLogisticId = `${order.wooCommerceOrderId ?? input.shipmentId}`.slice(0, 50);
    const now = new Date();
    const sendStartTime = now.toISOString().slice(0, 19).replace("T", " ");
    const sendEndTime = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    const description =
      settings.packageDescription?.trim() ||
      orderDescription(order, `Order ${order.wooCommerceOrderId ?? input.shipmentId}`);
    const cod = codAmountFromOrder(order);
    const body = {
      customerCode,
      digest,
      txlogisticId: txLogisticId,
      expressType: input.serviceCode ?? settings.defaultServiceCode ?? "EZ",
      orderType: input.type === "return" ? "2" : "1",
      serviceType: input.type === "exchange" ? "02" : "01",
      deliveryType: "04",
      payType: cod > 0 ? "PP_PM" : "PP_CASH",
      goodsType: "ITN1",
      priceCurrency: "EGP",
      weight: numericSetting(settings.defaultWeightKg, 1),
      length: numericSetting(settings.defaultLengthCm, 10),
      width: numericSetting(settings.defaultWidthCm, 10),
      height: numericSetting(settings.defaultHeightCm, 10),
      sendStartTime,
      sendEndTime,
      itemsValue: String(Math.round(order.payment.total_amount)),
      totalQuantity: String(orderItemCount(order)),
      remark: [order.notes, description].filter(Boolean).join(" | ").slice(0, 200),
      receiver: {
        name: `${firstName} ${lastName}`.trim(),
        mobile: order.customer.phone || "01000000000",
        phone: order.customer.phone || "01000000000",
        countryCode: "EGY",
        prov: "",
        city: "",
        area: "",
        address: order.customer.address || "Address on file",
        mailBox: order.customer.email || "",
      },
      sender: {
        name: settings.senderName || "Store",
        mobile: settings.senderPhone || "01000000000",
        phone: settings.senderPhone || "01000000000",
        countryCode: "EGY",
        prov: "",
        city: settings.senderCity || "Cairo",
        area: settings.senderArea || "",
        address: settings.senderAddress || "Warehouse address",
      },
      items: [
        {
          itemName: description,
          itemType: "ITN1",
          itemValue: String(Math.round(order.payment.total_amount)),
          number: String(orderItemCount(order)),
          priceCurrency: "EGP",
          desc: description,
        },
      ],
      offerFee: cod > 0 ? String(cod) : "0",
      operateType: 1,
    };
    const raw = await jntRequest({
      tenantId: input.tenantId,
      endpoint: "createOrder",
      body,
    });
    const data = readData(raw);
    const awb = pickString(data, ["waybill_code", "billCode", "bill_code", "waybillCode"]);
    if (!awb) throw new Error("J&T Egypt response missing waybill code");
    const label = await getJntLabel({
      tenantId: input.tenantId,
      awb,
      format: input.labelFormat ?? "pdf",
    }).catch(() => null);
    return {
      awb,
      provider: "jnt_egypt",
      externalId: pickString(data, ["tx_logistic_id", "txlogisticId"]) ?? txLogisticId,
      carrierTrackingStatus: "created",
      serviceCode: input.serviceCode ?? settings.defaultServiceCode,
      labelFormat: label?.format ?? input.labelFormat,
      labelUrl: label?.format === "pdf" ? label.url : undefined,
      labelData: label?.format === "pdf" ? label.data : undefined,
      thermalLabelUrl: label?.format !== "pdf" ? label?.url : undefined,
      thermalLabelData: label?.format !== "pdf" ? label?.data : undefined,
      carrierAccountRef: customerCode,
      rawCarrierStatus: pickString(data, ["sorting_code", "last_center_name"]),
    };
  },

  async trackShipment(input) {
    const raw = await jntRequest({
      tenantId: input.tenantId,
      endpoint: "trackOrder",
      body: { billCodes: input.awb },
    });
    const data = readData(raw);
    return {
      status:
        pickString(data, ["scanType", "status", "statusName", "desc"]) ??
        "tracking_updated",
      details: pickString(data, ["desc", "message", "scanName"]),
      raw,
    };
  },

  async cancelShipment(input) {
    const { customerCode, digest } = await baseJntBody(input.tenantId);
    const raw = await jntRequest({
      tenantId: input.tenantId,
      endpoint: "cancelOrder",
      body: {
        customerCode,
        digest,
        txlogisticId: input.externalId ?? input.awb,
        orderType: 1,
        reason: "Cancelled from OMS",
      },
    });
    return { status: "cancelled", details: pickString(raw, ["msg", "message"]), raw };
  },

  getLabel: getJntLabel,
};

