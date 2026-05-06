"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  Filter,
  Menu,
  Search,
  UserCircle2,
  X,
} from "lucide-react";
import { buildAuthHeaders, useSessionStore } from "@/store/zustand/session-store";
import { cn } from "@/lib/ui/cn";
import { canAccessPage } from "@/lib/auth/rbac";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useMediaQuery } from "@/lib/ui/use-media-query";
import { useUiStore } from "@/store/zustand/ui-store";
import { useOrderAlertsStore } from "@/store/zustand/order-alerts-store";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";

const topbarIconBtn =
  "flex size-11 shrink-0 items-center justify-center rounded-lg text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)] focus-visible:shadow-[var(--shadow-focus-ring)] focus-visible:outline-none";

const searchInputClass =
  "h-11 w-full rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-input-bg)] py-2 ps-10 pe-4 text-base leading-6 text-[color:var(--color-text-primary)] shadow-none outline-none transition-[border-color,box-shadow] placeholder:text-[color:var(--color-text-muted)] focus:border-[color:var(--color-primary)] focus:shadow-[var(--shadow-focus-ring)] focus:ring-0";

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const permissions = useSessionStore((s) => s.permissions);
  const authReady = useSessionStore((s) => s.authReady);
  const displayName = useSessionStore((s) => s.displayName);
  const tenantName = useSessionStore((s) => s.tenantName);
  const { t } = useLocale();
  const [mockOn, setMockOn] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [managerAlertCount, setManagerAlertCount] = useState(0);

  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const isMdUp = useMediaQuery("(min-width: 768px)");
  const isLgUp = useMediaQuery("(min-width: 1024px)");
  const orderUnread = useOrderAlertsStore((s) => s.unreadCount);
  const markNotificationsSeen = useOrderAlertsStore(
    (s) => s.markNotificationsSeen,
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dev/mock-status")
      .then((r) => r.json())
      .then((j: { enabled?: boolean }) => {
        if (!cancelled) setMockOn(!!j.enabled);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isMdUp) setSearchOpen(false);
  }, [isMdUp]);

  useEffect(() => {
    if (!authReady || !canAccessPage({ role, permissions }, "page:admin")) {
      setManagerAlertCount(0);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/summary", {
          headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        const alerts = (json.data?.overdueAlerts ?? []) as unknown[];
        if (!cancelled) setManagerAlertCount(alerts.length);
      } catch {
        if (!cancelled) setManagerAlertCount(0);
      }
    };

    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authReady, apiSecret, idToken, tenantId, userId, role, permissions]);

  const searchPlaceholder = useMemo(() => {
    if (pathname.startsWith("/tickets")) {
      return t("Search tickets, IDs, or agents…");
    }
    if (pathname.startsWith("/settings")) {
      return t("Search orders, tickets…");
    }
    return t("Search orders, customers, or items…");
  }, [pathname, t]);

  const bellCount = orderUnread + managerAlertCount;

  return (
    <header
      className={cn(
        "flex min-h-16 shrink-0 items-center gap-3 border-b border-[color:var(--color-divider)] bg-[color:var(--color-shell)] pt-safe shadow-[var(--shadow-notion-nav)]",
        "px-4 md:gap-4 md:px-6 lg:px-8",
      )}
    >
      <button
        type="button"
        className={cn(
          topbarIconBtn,
          "md:hidden",
          mobileNavOpen && "bg-[color:var(--color-hover-bg)] text-[color:var(--color-text-primary)]",
        )}
        aria-expanded={mobileNavOpen}
        aria-controls="app-sidebar-nav"
        aria-label={mobileNavOpen ? t("Close menu") : t("Open menu")}
        onClick={() => setMobileNavOpen(!mobileNavOpen)}
      >
        <Menu className="size-6" aria-hidden />
      </button>

      {mockOn ? (
        <span
          className="hidden shrink-0 rounded-lg border-0 bg-[color:var(--color-dev-badge-bg)] px-2 py-1 text-xs font-medium text-[color:var(--color-dev-badge-text)] sm:inline"
          title="DEV_MOCK_DATA=true"
        >
          {t("Mock data")}
        </span>
      ) : null}

      {isMdUp ? (
        <div className="relative min-w-0 max-w-xl flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-[color:var(--color-text-secondary)]"
            aria-hidden
          />
          <input
            type="search"
            placeholder={searchPlaceholder}
            className={searchInputClass}
            readOnly
            aria-label={t("Search (coming soon)")}
          />
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {searchOpen ? (
            <>
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-[color:var(--color-text-secondary)]"
                  aria-hidden
                />
                <input
                  type="search"
                  placeholder={searchPlaceholder}
                  className={cn(searchInputClass, "pe-10")}
                  readOnly
                  aria-label={t("Search (coming soon)")}
                  autoFocus
                />
              </div>
              <button
                type="button"
                className={topbarIconBtn}
                aria-label={t("Close search")}
                onClick={() => setSearchOpen(false)}
              >
                <X className="size-6" aria-hidden />
              </button>
            </>
          ) : (
            <button
              type="button"
              className={topbarIconBtn}
              aria-label={t("Search")}
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-6" aria-hidden />
            </button>
          )}
        </div>
      )}

      <div className="ms-auto flex min-w-0 items-center gap-1.5 md:gap-2">
        <div className="hidden items-center gap-1 md:flex">
          <button
            type="button"
            className={topbarIconBtn}
            aria-label={t("Calendar (coming soon)")}
          >
            <Calendar className="size-6" aria-hidden />
          </button>
          <button
            type="button"
            className={topbarIconBtn}
            aria-label={t("Filters (coming soon)")}
          >
            <Filter className="size-6" aria-hidden />
          </button>
        </div>

        <button
          type="button"
          className={cn(topbarIconBtn, "relative")}
          aria-label={
            bellCount > 0
              ? `${t("Order notifications")}, ${bellCount} ${t("alerts")}`
              : t("Order notifications")
          }
          onClick={() => {
            markNotificationsSeen();
            router.push(managerAlertCount > 0 ? "/admin" : "/orders");
          }}
        >
          <Bell className="size-6" />
          {bellCount > 0 ? (
            <span className="absolute top-1 end-1 min-h-[1.125rem] min-w-[1.125rem] rounded-full bg-[color:var(--color-error)] px-0.5 text-center text-[10px] font-semibold leading-tight text-white">
              {bellCount > 9 ? "9+" : bellCount}
            </span>
          ) : null}
        </button>
        <LanguageToggle className="hidden md:inline-flex" />
        <ThemeToggle />
        <div
          className={cn(
            "flex max-w-[38vw] min-w-0 items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] py-2 ps-2 pe-2.5 min-[400px]:max-w-none min-[400px]:ps-2.5 min-[400px]:pe-3",
            isLgUp ? "max-w-[220px]" : "md:max-w-[180px] lg:max-w-[220px]",
          )}
        >
          <UserCircle2
            className="size-8 shrink-0 text-[color:var(--color-text-secondary)]"
            aria-hidden
          />
          <div className="min-w-0 text-start text-xs leading-tight">
            {tenantName?.trim() ? (
              <div className="truncate text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                {tenantName.trim()}
              </div>
            ) : null}
            <div className="truncate text-sm font-medium text-[color:var(--color-text-primary)]">
              {displayName?.trim() || userId || t("Guest")}
            </div>
            <div className="hidden truncate text-[color:var(--color-text-secondary)] lg:block">
              {t(role)}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
