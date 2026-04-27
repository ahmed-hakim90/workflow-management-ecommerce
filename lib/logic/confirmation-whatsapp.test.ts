import { describe, expect, it } from "vitest";
import { formatConfirmationWhatsAppMessage } from "./confirmation-whatsapp";

describe("formatConfirmationWhatsAppMessage", () => {
  it("replaces WooCommerce order id and order link placeholders", () => {
    const message = formatConfirmationWhatsAppMessage(
      "مرحباً {name} — متابعة طلبك رقم {orderId}\n{orderLink}\nAWB {awb}",
      {
        name: "Ahmed Sayed",
        orderId: "9812",
        wooOrderId: "9812",
        orderLink: "https://store.example.com/order-tracking/9812",
        awb: "AWB-1",
      },
    );

    expect(message).toBe(
      "مرحباً Ahmed Sayed — متابعة طلبك رقم 9812\nhttps://store.example.com/order-tracking/9812\nAWB AWB-1",
    );
  });

  it("keeps older templates working without an order link", () => {
    const message = formatConfirmationWhatsAppMessage(
      "مرحباً {name} — طلب {orderId}",
      {
        name: "Sara",
        orderId: "internal-1",
        awb: "—",
      },
    );

    expect(message).toBe("مرحباً Sara — طلب internal-1");
  });
});
