/** Build wa.me link; assumes Egypt-style 01… numbers if no country code. */
export function buildWhatsAppUrl(phone: string, message?: string): string | null {
  const raw = phone.replace(/\D/g, "");
  if (!raw) return null;
  let n = raw;
  if (n.startsWith("0")) n = `20${n.slice(1)}`;
  if (n.length === 10 && !n.startsWith("20")) n = `20${n}`;
  const base = `https://wa.me/${n}`;
  if (!message?.trim()) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}
