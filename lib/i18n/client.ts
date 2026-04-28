"use client";

import { LOCALE_COOKIE, type Locale, normalizeLocale } from "@/lib/i18n/config";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${LOCALE_COOKIE}=`));
  if (!match) return null;
  return normalizeLocale(decodeURIComponent(match.split("=").slice(1).join("=")));
}

export function writeLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(
    locale,
  )}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
