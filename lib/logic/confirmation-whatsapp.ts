import type { Order, OrderLineItem, Shipment } from "@/lib/types/models";

type LegacyConfirmationWhatsAppParams = {
  name: string;
  orderId: string;
  awb: string;
  wooOrderId?: string;
  orderLink?: string;
};

type OrderConfirmationWhatsAppParams = {
  order: Order;
  shipments?: Shipment[];
  awb?: string;
  orderLink?: string;
};

type ConfirmationWhatsAppParams =
  | LegacyConfirmationWhatsAppParams
  | OrderConfirmationWhatsAppParams;

const UNSAFE_PATH_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function formatMoney(value: number | undefined): string {
  return (value ?? 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function displayOrderId(order: Order): string {
  return order.wooCommerceOrderId?.trim() || order.id;
}

function latestDeliveryAwb(order: Order, shipments: Shipment[] | undefined): string {
  return (
    shipments?.find((s) => s.type === "delivery")?.awb?.trim() ||
    order.latestShipmentAwb?.trim() ||
    "—"
  );
}

function stringifyTemplateValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map(stringifyTemplateValue).filter(Boolean).join("\n");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v != null && String(v).trim() !== "")
      .map(([k, v]) => `${k}: ${stringifyTemplateValue(v)}`);
    return entries.join(", ");
  }
  return String(value);
}

function readPath(source: unknown, path: string): unknown {
  const segments = path.split(".").filter(Boolean);
  let current: unknown = source;
  for (const segment of segments) {
    if (UNSAFE_PATH_KEYS.has(segment)) return undefined;
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function formatAttributes(value: Record<string, string> | undefined): string {
  if (!value) return "";
  return Object.entries(value)
    .filter(([, v]) => v.trim() !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

function itemFieldValue(item: OrderLineItem, rawField: string): string {
  const field = rawField.trim();
  switch (field) {
    case "name":
      return item.name;
    case "sku":
      return item.sku ?? "";
    case "quantity":
    case "qty":
      return String(item.quantity);
    case "unitPrice":
    case "unit_price":
    case "price":
      return formatMoney(item.unit_price);
    case "lineTotal":
    case "line_total":
    case "total":
    case "value":
      return formatMoney(item.line_total);
    case "productId":
    case "product_id":
      return item.product_id ?? "";
    case "variationId":
    case "variation_id":
      return item.variation_id ?? "";
    case "link":
    case "productUrl":
    case "product_url":
      return item.product_url ?? "";
    case "attributes":
    case "attrs":
      return formatAttributes(item.attributes);
    case "meta":
      return formatAttributes(item.meta);
    default:
      return stringifyTemplateValue(readPath(item, field));
  }
}

function formatItemSummary(item: OrderLineItem): string {
  const details = [
    item.sku ? `SKU: ${item.sku}` : "",
    formatAttributes(item.attributes),
    item.product_url ? `Link: ${item.product_url}` : "",
  ].filter(Boolean);
  const suffix = details.length ? ` (${details.join(" | ")})` : "";
  return `- ${item.name} x${item.quantity} = ${formatMoney(item.line_total)}${suffix}`;
}

function formatItemsWithFields(items: OrderLineItem[], fields: string[]): string {
  return items
    .map((item) =>
      fields
        .map((field) => itemFieldValue(item, field))
        .filter(Boolean)
        .join(" - "),
    )
    .filter(Boolean)
    .join("\n");
}

function buildOrderTemplateContext(params: OrderConfirmationWhatsAppParams) {
  const { order } = params;
  const items = order.lineItems ?? [];
  const awb = params.awb?.trim() || latestDeliveryAwb(order, params.shipments);
  const orderId = displayOrderId(order);
  const wooOrderId = order.wooCommerceOrderId?.trim() || orderId;
  const itemsSummary = items.map(formatItemSummary).join("\n");

  return {
    name: order.customer.name,
    orderId,
    wooOrderId,
    awb,
    orderLink: params.orderLink ?? "",
    customer: order.customer,
    payment: {
      status: order.payment.payment_status,
      total: formatMoney(order.payment.total_amount),
      totalAmount: order.payment.total_amount,
      paid: formatMoney(order.payment.paid_amount),
      paidAmount: order.payment.paid_amount,
      remaining: formatMoney(order.payment.remaining_amount),
      remainingAmount: order.payment.remaining_amount,
      cod: formatMoney(order.payment.cod_amount),
      codAmount: order.payment.cod_amount,
    },
    shipping: order.shipping
      ? {
          ...order.shipping,
          costFormatted: formatMoney(order.shipping.cost),
        }
      : undefined,
    items: {
      count: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      names: items.map((item) => item.name).join(", "),
      summary: itemsSummary,
      list: items,
    },
    products: itemsSummary,
    order: {
      ...order,
      displayId: orderId,
      wooOrderId,
    },
  };
}

function buildTemplateContext(params: ConfirmationWhatsAppParams) {
  if ("order" in params) return buildOrderTemplateContext(params);
  return {
    ...params,
    wooOrderId: params.wooOrderId ?? params.orderId,
    orderLink: params.orderLink ?? "",
    items: {
      count: 0,
      totalQuantity: 0,
      names: "",
      summary: "",
      list: [],
    },
    products: "",
  };
}

/**
 * تنسيق رسالة واتساب لفريق التأكيد (ليس المخزن) — مكان الإعداد: Shipment rules →
 * Shipment automation.
 */
export function formatConfirmationWhatsAppMessage(
  template: string,
  params: ConfirmationWhatsAppParams,
) {
  const context = buildTemplateContext(params);
  return template.replace(/\{([^{}]+)\}/g, (_match, token: string) => {
    const key = token.trim();
    if (key === "items" || key === "products") {
      return stringifyTemplateValue(readPath(context, "items.summary"));
    }
    if (key.startsWith("items:") || key.startsWith("products:")) {
      const fields = key.slice(key.indexOf(":") + 1).split(",");
      const items = readPath(context, "items.list");
      return Array.isArray(items)
        ? formatItemsWithFields(items as OrderLineItem[], fields)
        : "";
    }
    return stringifyTemplateValue(readPath(context, key));
  });
}
