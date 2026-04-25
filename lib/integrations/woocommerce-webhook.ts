import { createHmac, timingSafeEqual } from "crypto";
import { getServerEnv } from "@/lib/config/env";

/**
 * WooCommerce webhook signatures are base64-encoded HMAC-SHA256 of the raw body.
 * @see https://woocommerce.com/document/webhooks/#section-8
 */
export function verifyWooCommerceSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = getServerEnv().WOOCOMMERCE_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signatureHeader) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
  try {
    const a = Buffer.from(digest);
    const b = Buffer.from(signatureHeader);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
