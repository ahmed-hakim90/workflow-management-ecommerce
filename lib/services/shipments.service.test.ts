import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDevMockBackend } from "@/lib/dev/mock-backend";
import {
  createShipmentForOrder,
  getShipmentLabel,
} from "@/lib/services/shipments.service";

const originalDevMockData = process.env.DEV_MOCK_DATA;

beforeEach(() => {
  process.env.DEV_MOCK_DATA = "true";
  resetDevMockBackend();
});

afterAll(() => {
  if (originalDevMockData === undefined) {
    delete process.env.DEV_MOCK_DATA;
  } else {
    process.env.DEV_MOCK_DATA = originalDevMockData;
  }
});

describe("shipments service carrier selection", () => {
  it("preserves the existing mock/Bosta-compatible default path", async () => {
    const shipment = await createShipmentForOrder({
      tenantId: "default",
      orderId: "a2222222-2222-4222-8222-222222222202",
      actorUserId: "user-admin-1",
    });

    expect(shipment.provider).toBe("mock");
    expect(shipment.awb).toMatch(/^MOCK-/);
    expect(shipment.labelFormat).toBe("pdf");
  });

  it("records the selected carrier and thermal label option in mock mode", async () => {
    const shipment = await createShipmentForOrder({
      tenantId: "default",
      orderId: "a3333333-3333-4333-8333-333333333303",
      actorUserId: "user-admin-1",
      provider: "jnt_egypt",
      serviceCode: "EZ",
      labelFormat: "zpl",
    });

    expect(shipment.provider).toBe("jnt_egypt");
    expect(shipment.awb).toMatch(/^JTE-/);
    expect(shipment.serviceCode).toBe("EZ");
    expect(shipment.thermalLabelData).toContain("^XA");

    await expect(
      getShipmentLabel({
        tenantId: "default",
        shipmentId: shipment.id,
        format: "zpl",
      }),
    ).resolves.toMatchObject({
      format: "zpl",
      contentType: "text/plain",
    });
  });

  it("records FedEx as a selectable carrier", async () => {
    const shipment = await createShipmentForOrder({
      tenantId: "default",
      orderId: "a1111111-1111-4111-8111-111111111101",
      actorUserId: "user-admin-1",
      provider: "fedex",
      serviceCode: "INTERNATIONAL_PRIORITY",
      labelFormat: "pdf",
    });

    expect(shipment.provider).toBe("fedex");
    expect(shipment.awb).toMatch(/^FDX-/);
    expect(shipment.serviceCode).toBe("INTERNATIONAL_PRIORITY");
  });
});

