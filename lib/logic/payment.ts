import type { Payment, PaymentStatus } from "@/lib/types/models";

export function buildPayment(input: {
  payment_status: PaymentStatus;
  total_amount: number;
  paid_amount: number;
}): Payment {
  const total = round2(input.total_amount);
  const paid = round2(input.paid_amount);
  const remaining = round2(Math.max(0, total - paid));
  return {
    payment_status: input.payment_status,
    total_amount: total,
    paid_amount: paid,
    remaining_amount: remaining,
    cod_amount: remaining,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
