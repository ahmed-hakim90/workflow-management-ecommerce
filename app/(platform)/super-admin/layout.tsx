import { cookies } from "next/headers";
import Link from "next/link";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { LocalizedDom } from "@/components/i18n/LocalizedDom";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/config";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <LocaleProvider initialLocale={locale} preferInitialLocale>
      <LocalizedDom>
        <div className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)]">
          <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-card)]/80 px-4 py-4 shadow-[var(--shadow-neo-raised-sm)]">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--color-text-secondary)]">
                  Internal
                </p>
                <h1 className="text-lg font-semibold">Super Admin</h1>
              </div>
              <nav className="flex gap-2 text-sm">
                <Link
                  href="/super-admin"
                  className="rounded-xl px-3 py-2 text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]"
                >
                  Companies
                </Link>
                <Link
                  href="/super-admin/packages"
                  className="rounded-xl px-3 py-2 text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]"
                >
                  Packages
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </div>
      </LocalizedDom>
    </LocaleProvider>
  );
}
