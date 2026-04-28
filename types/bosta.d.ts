declare module "bosta" {
  class Bosta {
    constructor(apiKey: string, baseUrl?: string);
    deliveryTypes: Record<string, { code: number; value?: string }>;
    delivery: {
      createDelivery(
        type: number,
        specs: Record<string, unknown>,
        cod: number,
        dropOffAddress: Record<string, unknown>,
        businessReference: string,
        receiver: Record<string, unknown>,
        notes: string,
      ): Promise<{ _id?: string; trackingNumber?: string }>;
      trackDelivery?(
        trackingNumber: string,
      ): Promise<Record<string, unknown>>;
      cancelDelivery?(
        trackingNumberOrId: string,
      ): Promise<Record<string, unknown>>;
    };
  }
  export default Bosta;
}
