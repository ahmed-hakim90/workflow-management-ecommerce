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
  const [mockOn, setMockOn] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [managerAlertCount, setManagerAlertCount] = useState(0);

  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const isMdUp = useMediaQuery("(min-width: 768px)");
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
      return "Search tickets, IDs, or agents…";
    }
    if (pathname.startsWith("/settings")) {
      return "Search orders, tickets…";
    }
    return "Search orders, customers, or items…";
  }, [pathname]);

  const bellCount = orderUnread + managerAlertCount;

  return (
    <header
      className={cn(
        "flex min-h-14 shrink-0 items-center gap-3 border-b border-[color:var(--color-divider)] bg-[color:var(--color-shell)] px-4 pt-safe md:gap-4 md:px-6",
      )}
    >
      <button
        type="button"
        className={cn(
          "flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-raised-sm)] hover:shadow-[var(--shadow-neo-raised)] active:shadow-[var(--shadow-neo-pressed-sm)] md:hidden",
          mobileNavOpen && "text-[color:var(--color-text-primary)] shadow-[var(--shadow-neo-pressed-sm)]",
        )}
        aria-expanded={mobileNavOpen}
        aria-controls="app-sidebar-nav"
        aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
        onClick={() => setMobileNavOpen(!mobileNavOpen)}
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {mockOn ? (
        <span
          className="hidden shrink-0 rounded-xl border-0 bg-[color:var(--color-dev-badge-bg)] px-2 py-1 text-[11px] font-medium text-[color:var(--color-dev-badge-text)] shadow-[var(--shadow-neo-raised-sm)] sm:inline"
          title="DEV_MOCK_DATA=true"
        >
          Mock data
        </span>
      ) : null}

      {isMdUp ? (
        <div className="relative min-w-0 max-w-xl flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--color-text-secondary)]"
            aria-hidden
          />
          <input
            type="search"
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-xl border-0 bg-[color:var(--color-input-bg)] py-1.5 ps-9 pe-3 text-sm text-[color:var(--color-text-primary)] shadow-[var(--shadow-neo-inset)] outline-none placeholder:text-[color:var(--color-text-secondary)] focus:ring-2 focus:ring-[color:var(--color-primary)] focus:ring-offset-1 focus:ring-offset-[color:var(--color-bg)]"
            readOnly
            aria-label="Search (coming soon)"
          />
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {searchOpen ? (
            <>
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--color-text-secondary)]"
                  aria-hidden
                />
                <input
                  type="search"
                  placeholder={searchPlaceholder}
                  className="h-11 w-full rounded-xl border-0 bg-[color:var(--color-input-bg)] py-2 ps-9 pe-10 text-sm text-[color:var(--color-text-primary)] shadow-[var(--shadow-neo-inset)] outline-none placeholder:text-[color:var(--color-text-secondary)] focus:ring-2 focus:ring-[color:var(--color-primary)] focus:ring-offset-1 focus:ring-offset-[color:var(--color-bg)]"
                  readOnly
                  aria-label="Search (coming soon)"
                  autoFocus
                />
              </div>
              <button
                type="button"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-raised-sm)] hover:shadow-[var(--shadow-neo-raised)] active:shadow-[var(--shadow-neo-pressed-sm)]"
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
              >
                <X className="size-5" aria-hidden />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-raised-sm)] hover:shadow-[var(--shadow-neo-raised)] active:shadow-[var(--shadow-neo-pressed-sm)]"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-5" aria-hidden />
            </button>
          )}
        </div>
      )}

      <div className="ms-auto flex min-w-0 items-center gap-1.5 md:gap-2.5">
        <div className="hidden items-center gap-1.5 md:flex">
          <button
            type="button"
            className="flex min-h-9 min-w-9 items-center justify-center rounded-xl text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-raised-sm)] hover:shadow-[var(--shadow-neo-raised)] active:shadow-[var(--shadow-neo-pressed-sm)]"
            aria-label="Calendar (coming soon)"
          >
            <Calendar className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className="flex min-h-9 min-w-9 items-center justify-center rounded-xl text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-raised-sm)] hover:shadow-[var(--shadow-neo-raised)] active:shadow-[var(--shadow-neo-pressed-sm)]"
            aria-label="Filters (coming soon)"
          >
            <Filter className="size-4" aria-hidden />
          </button>
        </div>

        <button
          type="button"
          className="relative flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-raised-sm)] hover:shadow-[var(--shadow-neo-raised)] active:shadow-[var(--shadow-neo-pressed-sm)]"
          aria-label={
            bellCount > 0
              ? `Order notifications, ${bellCount} alerts`
              : "Order notifications"
          }
          onClick={() => {
            markNotificationsSeen();
            router.push(managerAlertCount > 0 ? "/admin" : "/orders");
          }}
        >
          <Bell className="size-5" />
          {bellCount > 0 ? (
            <span className="absolute top-1 end-1 min-h-[1.125rem] min-w-[1.125rem] rounded-full bg-[color:var(--color-error)] px-0.5 text-center text-[10px] font-semibold leading-tight text-white">
              {bellCount > 9 ? "9+" : bellCount}
            </span>
          ) : null}
        </button>
        <ThemeToggle />
        <div className="flex max-w-[40vw] min-w-0 items-center gap-2 rounded-xl bg-[color:var(--color-card)] py-1.5 ps-2.5 pe-2 shadow-[var(--shadow-neo-raised-sm)] min-[400px]:max-w-none min-[400px]:px-2.5 min-[400px]:pe-3 sm:pe-3.5">
          <UserCircle2
            className="size-7 shrink-0 text-[color:var(--color-text-secondary)] min-[400px]:size-8"
            aria-hidden
          />
          <div className="min-w-0 text-start text-xs">
            {tenantName?.trim() ? (
              <div className="truncate text-[10px] font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)] min-[400px]:text-[11px]">
                {tenantName.trim()}
              </div>
            ) : null}
            <div className="truncate font-medium text-[color:var(--color-text-primary)]">
              {displayName?.trim() || userId || "Guest"}
            </div>
            <div className="hidden truncate text-[color:var(--color-text-secondary)] sm:block">
              {role}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
