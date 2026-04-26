import { z } from "zod";

const serverSchema = z.object({
  OMS_API_SECRET: z.string().min(1).optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  WOOCOMMERCE_WEBHOOK_SECRET: z.string().optional(),
  BOSTA_API_KEY: z.string().optional(),
  BOSTA_BASE_URL: z.string().url().optional(),
  /** In-memory mock data for local development (no Firestore). */
  DEV_MOCK_DATA: z.string().optional(),
  /** When `firebase` and Firebase Admin is configured, staff API accepts only ID tokens (not OMS secret / staffApiKey). */
  STAFF_AUTH_MODE: z.enum(["legacy", "firebase"]).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
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
    STAFF_AUTH_MODE:
      process.env.STAFF_AUTH_MODE?.trim() || undefined,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}
