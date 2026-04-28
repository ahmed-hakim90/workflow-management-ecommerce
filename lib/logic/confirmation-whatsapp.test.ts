import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/types/models";
import { formatConfirmationWhatsAppMessage } from "./confirmation-whatsapp";

describe("formatConfirmationWhatsAppMessage", () => {
  const formatEgp = (value: number) =>
    value.toLocaleString("ar-EG-u-nu-latn", {
      style: "currency",
      currency: "EGP",
    });

  const order: Order = {
    id: "internal-1",
    tenantId: "default",
    customer: {
      name: "Ahmed Sayed",
      email: "ahmed@example.com",
      phone: "01000000000",
      address: "12 Nile St, Cairo",
    },
    payment: {
      payment_status: "cod",
      total_amount: 150,
      paid_amount: 0,
      remaining_amount: 150,
      cod_amount: 150,
    },
    status: "pending_confirmation",
    shipmentIds: [],
    wooCommerceOrderId: "9812",
    lineItems: [
      {
        id: "10",
        product_id: "100",
        name: "T-Shirt",
        sku: "TS-1",
        quantity: 2,
        unit_price: 50,
        line_total: 100,
        product_url: "https://store.example.com/product/t-shirt",
        attributes: { Size: "M", Color: "Black" },
      },
      {
        id: "11",
        product_id: "101",
        name: "Cap",
        sku: "CAP-1",
        quantity: 1,
        unit_price: 50,
        line_total: 50,
      },
    ],
    shipping: {
      method: "Flat rate",
      cost: 20,
    },
    createdAt: "2026-04-28T07:00:00.000Z",
    updatedAt: "2026-04-28T07:00:00.000Z",
  };

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

  it("replaces order, customer, payment, shipping, and safe dot-path placeholders", () => {
    const message = formatConfirmationWhatsAppMessage(
      "مرحباً {customer.name}\nالعنوان: {customer.address}\nالإجمالي: {payment.total}\nالشحن: {shipping.method}\nRaw: {order.payment.total_amount}\nUnsafe: {order.__proto__.polluted}",
      {
        order,
        awb: "AWB-1",
        orderLink: "https://store.example.com/order-tracking/9812",
      },
    );

    expect(message).toBe(
      `مرحباً Ahmed Sayed\nالعنوان: 12 Nile St, Cairo\nالإجمالي: ${formatEgp(150)}\nالشحن: Flat rate\nRaw: 150\nUnsafe: `,
    );
  });

  it("renders all products in a summary when an order has multiple items", () => {
    const message = formatConfirmationWhatsAppMessage("المنتجات:\n{items.summary}", {
      order,
      awb: "AWB-1",
    });

    expect(message).toContain(
      `- T-Shirt x2 = ${formatEgp(100)} (SKU: TS-1 | Size: M, Color: Black | Link: https://store.example.com/product/t-shirt)`,
    );
    expect(message).toContain(`- Cap x1 = ${formatEgp(50)} (SKU: CAP-1)`);
  });

  it("renders custom product rows from selected item fields", () => {
    const message = formatConfirmationWhatsAppMessage(
      "{items:name,quantity,lineTotal,sku,link}",
      {
        order,
        awb: "AWB-1",
      },
    );

    expect(message).toBe(
      `T-Shirt - 2 - ${formatEgp(100)} - TS-1 - https://store.example.com/product/t-shirt\nCap - 1 - ${formatEgp(50)} - CAP-1`,
    );
  });
});
