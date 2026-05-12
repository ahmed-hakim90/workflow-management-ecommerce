/**
 * Normalize customer phone for dedupe + database lookups.
 * Best-effort E.164: digits only, leading country code for common EG patterns.
 */
export function normalizeCustomerPhone(raw: string | undefined | null): string {
  if (raw == null) return "";
  const s = raw.trim().replace(/[\s\-().]/g, "");
  if (!s) return "";
  if (s.startsWith("+")) {
    return "+" + s.slice(1).replace(/\D/g, "");
  }
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length >= 10) {
    return "+20" + digits.slice(1);
  }
  if (digits.startsWith("20")) {
    return "+" + digits;
  }
  if (digits.length === 10) {
    return "+20" + digits;
  }
  return "+" + digits;
}
