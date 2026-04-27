/**
 * تنسيق رسالة واتساب لفريق التأكيد (ليس المخزن) — مكان الإعداد: Shipment rules →
 * Shipment automation.
 */
export function formatConfirmationWhatsAppMessage(
  template: string,
  params: {
    name: string;
    orderId: string;
    awb: string;
    wooOrderId?: string;
    orderLink?: string;
  },
) {
  return template
    .replaceAll("{name}", params.name)
    .replaceAll("{orderId}", params.orderId)
    .replaceAll("{wooOrderId}", params.wooOrderId ?? params.orderId)
    .replaceAll("{orderLink}", params.orderLink ?? "")
    .replaceAll("{awb}", params.awb);
}
