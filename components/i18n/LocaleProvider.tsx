"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LOCALE,
  getLocaleDirection,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n/config";
import { readLocaleCookie, writeLocaleCookie } from "@/lib/i18n/client";
import { translateLiteral } from "@/lib/i18n/dictionaries";
import { useProfileStore } from "@/store/zustand/profile-store";

type LocaleContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (value: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
  preferInitialLocale = false,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
  preferInitialLocale?: boolean;
}) {
  const storeLanguage = useProfileStore((s) => s.language);
  const setProfile = useProfileStore((s) => s.setProfile);
  const [locale, setLocaleState] = useState<Locale>(() =>
    normalizeLocale(
      preferInitialLocale
        ? initialLocale
        : readLocaleCookie() ?? storeLanguage ?? initialLocale,
    ),
  );

  const setLocale = useCallback(
    (nextLocale: Locale) => {
      setLocaleState(nextLocale);
      setProfile({ language: nextLocale });
      writeLocaleCookie(nextLocale);
    },
    [setProfile],
  );

  useEffect(() => {
    const nextLocale = normalizeLocale(
      preferInitialLocale
        ? initialLocale
        : readLocaleCookie() ?? storeLanguage ?? initialLocale,
    );
    setLocaleState(nextLocale);
  }, [initialLocale, preferInitialLocale, storeLanguage]);

  useEffect(() => {
    const dir = getLocaleDirection(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.body.dir = dir;
    writeLocaleCookie(locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir: getLocaleDirection(locale),
      setLocale,
      t: (text) => translateLiteral(locale, text),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE,
      dir: getLocaleDirection(DEFAULT_LOCALE),
      setLocale: () => {},
      t: (value: string) => value,
    } satisfies LocaleContextValue;
  }
  return ctx;
}
