import { cookies } from "next/headers";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { LocalizedDom } from "@/components/i18n/LocalizedDom";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/config";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <LocaleProvider initialLocale={locale} preferInitialLocale>
      <LocalizedDom>
        <div className="min-h-screen bg-[color:var(--color-bg)]">{children}</div>
      </LocalizedDom>
    </LocaleProvider>
  );
}
