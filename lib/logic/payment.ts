import type { Payment, PaymentStatus } from "@/lib/types/models";

/**
 * يحسب أرقام الدفع بناءً على حالة الدفع.
 * COD → كل المبلغ يتجمع عند التسليم
 * partial → الباقي يتجمع عند التسليم
 * paid → مفيش كاش عند التسليم
 * unpaid → الكاش هيتحصل لاحقاً (مش COD، يعني تحويل بنكي مثلاً)
 */
export function buildPayment(input: {
  payment_status: PaymentStatus;
  total_amount: number;
  paid_amount: number;
}): Payment {
  const total = round2(input.total_amount);
  const paid = round2(input.paid_amount);
  const remaining = round2(Math.max(0, total - paid));
  const cod_amount =
    input.payment_status === "cod" || input.payment_status === "partial"
      ? remaining
      : 0;
  return {
    payment_status: input.payment_status,
    total_amount: total,
    paid_amount: paid,
    remaining_amount: remaining,
    cod_amount,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
