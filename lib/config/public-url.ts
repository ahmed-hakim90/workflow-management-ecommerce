/**
 * Canonical public HTTPS base for this deployment (webhooks, emails).
 * Prefer NEXT_PUBLIC_APP_URL; on Vercel, VERCEL_URL is set automatically.
 */
export function serverPublicBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  return "";
}
