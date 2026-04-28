export const LOCALE_COOKIE = "store-oms-locale";

export const SUPPORTED_LOCALES = ["en", "ar"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

export const LOCALE_DIRECTIONS: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
};

export const LOCALE_NUMBER_FORMATS: Record<Locale, string> = {
  en: "en-US",
  ar: "ar-EG-u-nu-latn",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale);
}

export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getNextLocale(locale: Locale): Locale {
  return locale === "ar" ? "en" : "ar";
}

export function getLocaleDirection(locale: Locale) {
  return LOCALE_DIRECTIONS[locale];
}
