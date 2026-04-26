import { z } from "zod";
import type {
  OrderCustomer,
  OrderLineItem,
  OrderShipping,
  Payment,
  PaymentStatus,
} from "@/lib/types/models";
import { buildPayment } from "@/lib/logic/payment";

/** JSON values often arrive as string or number from the WC REST / webhooks. */
const wcStringOrNumber = z.union([z.string(), z.number()]).nullable().optional();
const toNum = (v: unknown, fallback = 0): number => {
  if (v == null || v === "") return fallback;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const s = String(v).replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isNaN(n) ? fallback : n;
};

const wcLineItemSchema = z
  .object({
    id: z.union([z.number(), z.string()]).optional(),
    name: wcStringOrNumber,
    sku: z.union([z.string(), z.number()]).optional().nullable(),
    quantity: wcStringOrNumber,
    price: wcStringOrNumber,
    total: wcStringOrNumber,
  })
  .loose();

const wcOrderSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    billing: z
      .object({
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        address_1: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postcode: z.string().optional(),
        country: z.string().optional(),
      })
      .optional()
      .nullable(),
    total: wcStringOrNumber,
    date_paid: z.string().nullable().optional(),
    payment_method: z.string().optional().nullable(),
    customer_note: z.string().optional().nullable(),
    line_items: z.array(wcLineItemSchema).optional().nullable(),
    shipping_lines: z
      .array(
        z
          .object({
            method_title: z.string().optional().nullable(),
            total: wcStringOrNumber,
          })
          .loose(),
      )
      .optional()
      .nullable(),
  })
  .loose();

function lineItemName(n: unknown): string {
  if (n == null) return "Item";
  const s = String(n).trim();
  return s || "Item";
}

export function mapWooCommerceOrder(body: unknown): {
  wooOrderId: string;
  customer: OrderCustomer;
  payment: Payment;
  lineItems?: OrderLineItem[];
  shipping?: OrderShipping;
  notes?: string;
} {
  const parsed = wcOrderSchema.safeParse(body);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const at = issue?.path?.length
      ? `${issue.path.join(".")}: ${issue.message}`
      : parsed.error.issues[0]?.message;
    throw new Error(at ?? "Invalid WooCommerce order payload (schema)");
  }
  const w = parsed.data;
  const billing = w.billing ?? undefined;

  const wooOrderId = String(w.id);
  const name = [billing?.first_name, billing?.last_name]
    .filter((x): x is string => Boolean(x && String(x).trim()))
    .map((s) => String(s).trim())
    .join(" ");
  const customer: OrderCustomer = {
    name: name || "Customer",
    email: billing?.email ?? undefined,
    phone: billing?.phone ? String(billing.phone) : undefined,
    address: [
      billing?.address_1,
      billing?.city,
      billing?.state,
      billing?.postcode,
      billing?.country,
    ]
      .filter((x) => x != null && String(x).trim() !== "")
      .map((x) => String(x).trim())
      .join(", "),
  };

  const total = toNum(w.total, 0);
  const paid = w.date_paid ? total : 0;
  const method = (w.payment_method != null
    ? String(w.payment_method)
    : ""
  ).toLowerCase();
  let payment_status: PaymentStatus = "partial";
  if (method.includes("cod") || method === "cod") {
    payment_status = "cod";
  } else if (paid >= total && total > 0) {
    payment_status = "paid";
  }

  const payment = buildPayment({
    payment_status,
    total_amount: total,
    paid_amount: paid,
  });

  const rawLines = w.line_items;
  const lineItems: OrderLineItem[] | undefined = rawLines?.length
    ? rawLines.map((li) => {
        const qty = toNum(li.quantity, 1) || 1;
        const unit = toNum(li.price, 0);
        const lineTotal = toNum(li.total, unit * qty);
        return {
          id: li.id !== undefined ? String(li.id) : undefined,
          name: lineItemName(li.name),
          sku: li.sku != null && li.sku !== "" ? String(li.sku) : undefined,
          quantity: qty,
          unit_price: unit,
          line_total: lineTotal,
        };
      })
    : undefined;

  let shipping: OrderShipping | undefined;
  if (w.shipping_lines?.length) {
    const sl = w.shipping_lines[0];
    const cost = toNum(sl?.total, 0);
    const title = sl?.method_title;
    shipping = {
      method: title != null ? String(title) : undefined,
      cost,
    };
  }

  const notes = w.customer_note
    ? String(w.customer_note).trim() || undefined
    : undefined;

  return { wooOrderId, customer, payment, lineItems, shipping, notes };
}
