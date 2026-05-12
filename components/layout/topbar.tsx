"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { AnchoredDropdown } from "@/components/ui/dropdown-popover";
import { Button } from "@/components/ui/button";
import { AppBreadcrumb } from "@/components/layout/app-breadcrumb";
import { pathnameToTopbarBreadcrumbs } from "@/lib/ui/topbar-breadcrumb";

const topbarIconBtn =
  "flex size-9 shrink-0 items-center justify-center rounded-[var(--ds-radius-md)] text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)] focus-visible:shadow-[var(--shadow-focus-ring)] focus-visible:outline-none";

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
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);

  const [mockOn, setMockOn] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [managerAlertCount, setManagerAlertCount] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const calRef = useRef<HTMLButtonElement>(null);
  const filterRef = useRef<HTMLButtonElement>(null);

  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const isMdUp = useMediaQuery("(min-width: 768px)");
  const isLgUp = useMediaQuery("(min-width: 1024px)");
  const orderUnread = useOrderAlertsStore((s) => s.unreadCount);
  const markNotificationsSeen = useOrderAlertsStore(
    (s) => s.markNotificationsSeen,
  );

  const todayLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date());
    } catch {
      return new Date().toDateString();
    }
  }, []);

  const filterContext = useMemo(() => {
    if (pathname.startsWith("/orders"))
      return { href: "/orders", hash: "#app-page-filters" as const };
    if (pathname.startsWith("/tickets"))
      return { href: "/tickets", hash: "#app-page-filters" as const };
    return null;
  }, [pathname]);

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

  const breadcrumbSegments = useMemo(
    () => pathnameToTopbarBreadcrumbs(pathname, t),
    [pathname, t],
  );

  const bellCount = orderUnread + managerAlertCount;

  function openPalette() {
    setSearchOpen(false);
    setCommandPaletteOpen(true);
  }

  function scrollToPageFilters() {
    setFilterOpen(false);
    if (!filterContext) return;
    const { href, hash } = filterContext;
    if (pathname === href) {
      window.requestAnimationFrame(() => {
        document
          .getElementById("app-page-filters")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      if (typeof window !== "undefined" && window.location.hash !== hash) {
        window.history.replaceState(null, "", `${href}${hash}`);
      }
      return;
    }
    router.push(`${href}${hash}`);
  }

  return (
    <header
      className={cn(
        "flex min-h-[var(--ds-topbar-h)] shrink-0 items-center gap-2 border-b border-[color:var(--color-divider)] bg-[color:var(--color-shell)] pt-safe shadow-[var(--shadow-notion-nav)]",
        "px-4 md:gap-3 md:px-6 lg:px-8",
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
        <Menu className="size-[18px]" aria-hidden />
      </button>

      {mockOn ? (
        <span
          className="hidden shrink-0 rounded-[var(--ds-radius-md)] border border-[color:var(--color-dev-badge-border)] bg-[color:var(--color-dev-badge-bg)] px-2 py-1 text-xs font-medium text-[color:var(--color-dev-badge-text)] sm:inline"
          title="DEV_MOCK_DATA=true"
        >
          {t("Mock data")}
        </span>
      ) : null}

      {isMdUp ? (
        <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-4">
          {breadcrumbSegments.length > 0 ? (
            <div className="min-w-0 max-w-[min(42%,18rem)] shrink overflow-hidden border-s border-[color:var(--color-divider)] ps-3 lg:max-w-[min(38%,22rem)] lg:ps-4">
              <AppBreadcrumb segments={breadcrumbSegments} variant="inline" />
            </div>
          ) : null}
          <button
            type="button"
            onClick={openPalette}
            className="relative flex min-h-9 min-w-0 max-w-xl flex-1 cursor-text items-center rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] py-1.5 ps-9 pe-3 text-start text-[13px] shadow-none transition-[border-color,box-shadow] hover:border-[color:var(--color-border-strong)] hover:bg-[color:var(--color-input-bg)] focus-visible:border-[color:var(--color-primary)] focus-visible:shadow-[var(--shadow-focus-ring)] focus-visible:outline-none"
            aria-label={t("Quick navigation")}
          >
            <Search
              className="pointer-events-none absolute start-2.5 top-1/2 size-[17px] -translate-y-1/2 text-[color:var(--color-text-muted)]"
              aria-hidden
            />
            <span className="truncate text-[13px] text-[color:var(--color-text-muted)]">
              {searchPlaceholder}
            </span>
            <kbd className="ms-auto hidden shrink-0 rounded border border-[color:var(--color-border)] bg-[color:var(--color-shell)] px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--color-text-muted)] sm:inline">
              ⌘K
            </kbd>
          </button>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {searchOpen ? (
            <>
              <button
                type="button"
                onClick={openPalette}
                className="relative flex min-h-9 min-w-0 flex-1 cursor-text items-center rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] py-1.5 ps-9 pe-3 text-start shadow-none"
                aria-label={t("Quick navigation")}
              >
                <Search
                  className="pointer-events-none absolute start-2.5 top-1/2 size-[17px] -translate-y-1/2 text-[color:var(--color-text-muted)]"
                  aria-hidden
                />
                <span className="truncate text-[13px] text-[color:var(--color-text-muted)]">
                  {searchPlaceholder}
                </span>
              </button>
              <button
                type="button"
                className={topbarIconBtn}
                aria-label={t("Close search")}
                onClick={() => setSearchOpen(false)}
              >
                <X className="size-[18px]" aria-hidden />
              </button>
            </>
          ) : (
            <button
              type="button"
              className={topbarIconBtn}
              aria-label={t("Search")}
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-[18px]" aria-hidden />
            </button>
          )}
        </div>
      )}

      <div className="ms-auto flex min-w-0 items-center gap-1.5 md:gap-2">
        <div className="relative hidden items-center gap-1 md:flex">
          <button
            ref={calRef}
            type="button"
            className={topbarIconBtn}
            aria-label={t("Calendar")}
            aria-expanded={calendarOpen}
            aria-haspopup="dialog"
            onClick={() => {
              setFilterOpen(false);
              setCalendarOpen((v) => !v);
            }}
          >
            <Calendar className="size-[18px]" aria-hidden />
          </button>
          <AnchoredDropdown
            open={calendarOpen}
            onClose={() => setCalendarOpen(false)}
            anchorRef={calRef}
            width={300}
          >
            <div className="space-y-2 px-2 py-1">
              <p className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                {t("Calendar")}
              </p>
              <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
                {todayLabel}
              </p>
              <p className="text-sm text-[color:var(--color-text-secondary)]">
                {t("Full calendar and scheduling will connect here.")}
              </p>
            </div>
          </AnchoredDropdown>

          <button
            ref={filterRef}
            type="button"
            className={topbarIconBtn}
            aria-label={t("Page filters")}
            aria-expanded={filterOpen}
            aria-haspopup="dialog"
            onClick={() => {
              setCalendarOpen(false);
              setFilterOpen((v) => !v);
            }}
          >
            <Filter className="size-[18px]" aria-hidden />
          </button>
          <AnchoredDropdown
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            anchorRef={filterRef}
            width={300}
          >
            <div className="space-y-3 px-2 py-1">
              <p className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                {t("Page filters")}
              </p>
              {filterContext ? (
                <>
                  <p className="text-sm text-[color:var(--color-text-secondary)]">
                    {t("Use the filters on this page.")}
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full"
                    onClick={scrollToPageFilters}
                  >
                    {t("Jump to filters")}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-[color:var(--color-text-secondary)]">
                  {t(
                    "Filter tools for this view are not available on this page.",
                  )}
                </p>
              )}
            </div>
          </AnchoredDropdown>
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
          <Bell className="size-[18px]" />
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
            "flex max-w-[38vw] min-w-0 items-center gap-2 rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] py-1.5 ps-2 pe-2 min-[400px]:max-w-none min-[400px]:ps-2.5 min-[400px]:pe-2.5",
            isLgUp ? "max-w-[220px]" : "md:max-w-[180px] lg:max-w-[220px]",
          )}
        >
          <UserCircle2
            className="size-7 shrink-0 text-[color:var(--color-text-muted)]"
            aria-hidden
          />
          <div className="min-w-0 text-start text-xs leading-tight">
            {tenantName?.trim() ? (
              <div className="truncate text-[11px] font-medium text-[color:var(--color-text-secondary)]">
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
