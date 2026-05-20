import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  WOOCOMMERCE_WEBHOOK_SECRET: z.string().optional(),
  /** When `"1"`, persist raw WooCommerce JSON under `orders/{id}/webhook_snapshots/{deliveryId}`. */
  WOOCOMMERCE_STORE_RAW_PAYLOAD: z.string().optional(),
  BOSTA_API_KEY: z.string().optional(),
  BOSTA_BASE_URL: z.string().url().optional(),
  JNT_EGYPT_API_ACCOUNT: z.string().optional(),
  JNT_EGYPT_CUSTOMER_CODE: z.string().optional(),
  JNT_EGYPT_PASSWORD: z.string().optional(),
  JNT_EGYPT_DIGEST_SECRET: z.string().optional(),
  JNT_EGYPT_BASE_URL: z.string().url().optional(),
  FEDEX_CLIENT_ID: z.string().optional(),
  FEDEX_CLIENT_SECRET: z.string().optional(),
  FEDEX_ACCOUNT_NUMBER: z.string().optional(),
  FEDEX_BASE_URL: z.string().url().optional(),
  /** In-memory mock data for local development (no Supabase). */
  DEV_MOCK_DATA: z.string().optional(),
  /** Legacy compatibility flag; Supabase access tokens are preferred. */
  STAFF_AUTH_MODE: z.enum(["legacy", "firebase"]).optional(),
  /** Firebase Admin service account JSON string for onboarding token verification. */
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  /** Separate internal token for `/api/platform/*` super-admin routes. */
  PLATFORM_ADMIN_SECRET: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  AUTOMATION_SECRET: z.string().optional(),
  N8N_HMAC_SECRET: z.string().optional(),
  N8N_DEFAULT_WEBHOOK_URL: z.string().url().optional(),
  /** Upstash QStash token — enables async webhook processing + n8n redelivery. */
  QSTASH_TOKEN: z.string().optional(),
  /** Verify QStash callbacks (current signing key from Upstash console). */
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  /** Public base URL of this deployment, e.g. https://oms.example.com (no trailing slash). */
  OMS_PUBLIC_BASE_URL: z.string().url().optional(),
  /** Protect `/api/cron/*` (e.g. Vercel Cron `Authorization: Bearer …`). */
  CRON_SECRET: z.string().optional(),
  /** When `"1"`, `/api/internal/automation/send-template` enqueues QStash instead of sending inline. */
  WHATSAPP_OUTBOUND_QUEUE: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().optional(),
  OLLAMA_MODEL: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function getServerEnv(): ServerEnv {
  return serverSchema.parse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    WOOCOMMERCE_WEBHOOK_SECRET: process.env.WOOCOMMERCE_WEBHOOK_SECRET,
    WOOCOMMERCE_STORE_RAW_PAYLOAD: process.env.WOOCOMMERCE_STORE_RAW_PAYLOAD,
    BOSTA_API_KEY: process.env.BOSTA_API_KEY,
    BOSTA_BASE_URL: process.env.BOSTA_BASE_URL,
    JNT_EGYPT_API_ACCOUNT: process.env.JNT_EGYPT_API_ACCOUNT,
    JNT_EGYPT_CUSTOMER_CODE: process.env.JNT_EGYPT_CUSTOMER_CODE,
    JNT_EGYPT_PASSWORD: process.env.JNT_EGYPT_PASSWORD,
    JNT_EGYPT_DIGEST_SECRET: process.env.JNT_EGYPT_DIGEST_SECRET,
    JNT_EGYPT_BASE_URL: process.env.JNT_EGYPT_BASE_URL,
    FEDEX_CLIENT_ID: process.env.FEDEX_CLIENT_ID,
    FEDEX_CLIENT_SECRET: process.env.FEDEX_CLIENT_SECRET,
    FEDEX_ACCOUNT_NUMBER: process.env.FEDEX_ACCOUNT_NUMBER,
    FEDEX_BASE_URL: process.env.FEDEX_BASE_URL,
    DEV_MOCK_DATA: process.env.DEV_MOCK_DATA,
    STAFF_AUTH_MODE:
      process.env.STAFF_AUTH_MODE?.trim() || undefined,
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    PLATFORM_ADMIN_SECRET: process.env.PLATFORM_ADMIN_SECRET,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
    AUTOMATION_SECRET: process.env.AUTOMATION_SECRET,
    N8N_HMAC_SECRET: process.env.N8N_HMAC_SECRET,
    N8N_DEFAULT_WEBHOOK_URL: process.env.N8N_DEFAULT_WEBHOOK_URL,
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
    QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
    OMS_PUBLIC_BASE_URL: process.env.OMS_PUBLIC_BASE_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    WHATSAPP_OUTBOUND_QUEUE: process.env.WHATSAPP_OUTBOUND_QUEUE,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
    OLLAMA_MODEL: process.env.OLLAMA_MODEL,
  });
}
