import { createHash } from "crypto";
import type { OrderCustomer, OrderLineItem, OrderShipping, Payment } from "@/lib/types/models";

type FingerprintInput = {
  customer: OrderCustomer;
  payment: Pick<Payment, "payment_status" | "total_amount" | "paid_amount" | "remaining_amount" | "cod_amount">;
  lineItems?: OrderLineItem[];
  shipping?: OrderShipping;
  notes?: string;
};

/** ترتيب ثابت لمفاتيح JSON لتفادي اختلاف الهاش لنفس المحتوى. */
function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((x) => stableStringify(x)).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify((obj as Record<string, unknown>)[k])}`,
  );
  return `{${parts.join(",")}}`;
}

/**
 * بصمة لمحتوى الويب هوك بعد التطبيع — إذا لم تتغير نتخطى سجلات النشاط المكررة.
 */
export function orderIngestFingerprint(input: FingerprintInput): string {
  const normalized = {
    customer: {
      name: input.customer.name?.trim() ?? "",
      email: input.customer.email?.trim() ?? "",
      phone: input.customer.phone?.trim() ?? "",
      address: input.customer.address?.trim() ?? "",
    },
    payment: {
      payment_status: input.payment.payment_status,
      total_amount: input.payment.total_amount,
      paid_amount: input.payment.paid_amount,
      remaining_amount: input.payment.remaining_amount,
      cod_amount: input.payment.cod_amount,
    },
    lineItems: (input.lineItems ?? []).map((li) => ({
      id: li.id ?? "",
      sku: li.sku ?? "",
      name: li.name,
      quantity: li.quantity,
      unit_price: li.unit_price,
      line_total: li.line_total,
      unit_cost: li.unit_cost ?? 0,
      line_cost: li.line_cost ?? 0,
    })),
    shipping: input.shipping
      ? { method: input.shipping.method ?? "", cost: input.shipping.cost }
      : null,
    notes: input.notes?.trim() ?? "",
  };
  return createHash("sha256").update(stableStringify(normalized), "utf8").digest("hex");
}
