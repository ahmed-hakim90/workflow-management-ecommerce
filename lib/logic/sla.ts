/**
 * منطق SLA للمحادثات — أرقام افتراضية قابلة للضبط من إعدادات المستأجر.
 */

export const DEFAULT_FIRST_RESPONSE_MINUTES = 5;
export const DEFAULT_CUSTOMER_IDLE_HOURS = 24;
export const DEFAULT_INTERNAL_ACTION_HOURS = 2;

/** ثوانٍ قبل الموعد النهائي لإطلاق sla.warning مرة واحدة. */
export const SLA_WARNING_LEAD_SECONDS = 90;

export function addMinutesIso(minutes: number, fromMs: number = Date.now()): string {
  return new Date(fromMs + minutes * 60_000).toISOString();
}

export function addHoursIso(hours: number, fromMs: number = Date.now()): string {
  return new Date(fromMs + hours * 3600_000).toISOString();
}

export function parseIsoMs(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}
