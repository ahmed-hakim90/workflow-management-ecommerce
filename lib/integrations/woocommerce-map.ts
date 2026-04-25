import { z } from "zod";
import type {
  OrderCustomer,
  OrderLineItem,
  OrderShipping,
  Payment,
  PaymentStatus,
} from "@/lib/types/models";
import { buildPayment } from "@/lib/logic/payment";

const wooOrderSchema = z.object({
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
    .optional(),
  total: z.string().optional(),
  date_paid: z.string().nullable().optional(),
  payment_method: z.string().optional(),
  customer_note: z.string().optional(),
  line_items: z
    .array(
      z.object({
        id: z.union([z.number(), z.string()]).optional(),
        name: z.string(),
        sku: z.union([z.string(), z.number()]).optional(),
        quantity: z.number().optional(),
        price: z.string().optional(),
        total: z.string().optional(),
      }),
    )
    .optional(),
  shipping_lines: z
    .array(
      z.object({
        method_title: z.string().optional(),
        total: z.string().optional(),
      }),
    )
    .optional(),
});

export function mapWooCommerceOrder(body: unknown): {
  wooOrderId: string;
  customer: OrderCustomer;
  payment: Payment;
  lineItems?: OrderLineItem[];
  shipping?: OrderShipping;
  notes?: string;
} {
  const parsed = wooOrderSchema.parse(body);
  const wooOrderId = String(parsed.id);
  const name = [parsed.billing?.first_name, parsed.billing?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const customer: OrderCustomer = {
    name: name || "Customer",
    email: parsed.billing?.email,
    phone: parsed.billing?.phone,
    address: [
      parsed.billing?.address_1,
      parsed.billing?.city,
      parsed.billing?.state,
      parsed.billing?.postcode,
      parsed.billing?.country,
    ]
      .filter(Boolean)
      .join(", "),
  };

  const total = Number(parsed.total ?? "0");
  const paid = parsed.date_paid ? total : 0;
  const method = (parsed.payment_method ?? "").toLowerCase();
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

  const lineItems: OrderLineItem[] | undefined = parsed.line_items?.length
    ? parsed.line_items.map((li) => {
        const qty = li.quantity ?? 1;
        const unit = Number(li.price ?? "0");
        const lineTotal = Number(li.total ?? String(unit * qty));
        return {
          id: li.id !== undefined ? String(li.id) : undefined,
          name: li.name,
          sku: li.sku !== undefined ? String(li.sku) : undefined,
          quantity: qty,
          unit_price: unit,
          line_total: lineTotal,
        };
      })
    : undefined;

  let shipping: OrderShipping | undefined;
  if (parsed.shipping_lines?.length) {
    const sl = parsed.shipping_lines[0];
    shipping = {
      method: sl.method_title,
      cost: Number(sl.total ?? "0"),
    };
  }

  const notes = parsed.customer_note?.trim() || undefined;

  return { wooOrderId, customer, payment, lineItems, shipping, notes };
}
