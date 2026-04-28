import { cookies } from "next/headers";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { LocalizedDom } from "@/components/i18n/LocalizedDom";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/config";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-[color:var(--color-bg)]">{children}</div>;
}
