import { z } from "zod";

const serverSchema = z.object({
  OMS_API_SECRET: z.string().min(1).optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  WOOCOMMERCE_WEBHOOK_SECRET: z.string().optional(),
  BOSTA_API_KEY: z.string().optional(),
  BOSTA_BASE_URL: z.string().url().optional(),
  /** In-memory mock data for local development (no Firestore). */
  DEV_MOCK_DATA: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function getServerEnv(): ServerEnv {
  return serverSchema.parse({
    OMS_API_SECRET: process.env.OMS_API_SECRET,
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    WOOCOMMERCE_WEBHOOK_SECRET: process.env.WOOCOMMERCE_WEBHOOK_SECRET,
    BOSTA_API_KEY: process.env.BOSTA_API_KEY,
    BOSTA_BASE_URL: process.env.BOSTA_BASE_URL,
    DEV_MOCK_DATA: process.env.DEV_MOCK_DATA,
  });
}
