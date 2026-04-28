"use client";

import { DomTranslator } from "@/components/i18n/DomTranslator";
import { useLocale } from "@/components/i18n/LocaleProvider";

export function LocalizedDom({ children }: { children: React.ReactNode }) {
  const { locale, dir } = useLocale();
  return (
    <div lang={locale} dir={dir}>
      <DomTranslator locale={locale} />
      {children}
    </div>
  );
}
