"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Package,
  Truck,
  Ticket,
  MessageSquare,
  Settings,
  PanelLeftClose,
  PanelLeft,
  HelpCircle,
  LogOut,
  Warehouse,
  Users,
  UserRound,
  Shield,
  ChevronDown,
  Landmark,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useMediaQuery } from "@/lib/ui/use-media-query";
import { useUiStore } from "@/store/zustand/ui-store";
import { supabaseClientSignOut } from "@/lib/supabase/client-sign-out";
import { buildAuthHeaders, useSessionStore } from "@/store/zustand/session-store";
import { can, canAccessPage, type PagePermission } from "@/lib/auth/rbac";
import { useLocale } from "@/components/i18n/LocaleProvider";

const navItems: {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: PagePermission;
}[] = [
  { href: "/analytics", label: "Analytics", icon: BarChart3, permission: "page:analytics" },
  { href: "/accounts", label: "Accounts", icon: Landmark, permission: "page:accounts" },
  { href: "/orders", label: "Orders", icon: Package, permission: "page:orders" },
  {
    href: "/customers",
    label: "Customers",
    icon: UserRound,
    permission: "page:orders",
  },
  { href: "/shipments", label: "Shipments", icon: Truck, permission: "page:shipments" },
  { href: "/tickets", label: "Tickets", icon: Ticket, permission: "page:tickets" },
  { href: "/inbox", label: "Inbox", icon: MessageSquare, permission: "page:inbox" },
  {
    href: "/warehouse",
    label: "Warehouse",
    icon: Warehouse,
    permission: "page:warehouse",
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Shield,
    permission: "page:admin",
  },
  {
    href: "/users",
    label: "Users",
    icon: Users,
    permission: "page:users",
  },
  { href: "/settings", label: "Settings", icon: Settings, permission: "page:settings" },
];

function navActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const ROLE_TITLE: Record<string, string> = {
  admin: "System Admin",
  moderator: "Ops Manager",
  confirmation: "Confirmation",
  invoicing: "Invoicing",
  warehouse: "Warehouse",
  support: "Support",
  viewer: "Viewer",
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = useSessionStore((s) => s.signOut);
  const displayName = useSessionStore((s) => s.displayName);
  const tenantName = useSessionStore((s) => s.tenantName);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const permissions = useSessionStore((s) => s.permissions);
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const authReady = useSessionStore((s) => s.authReady);
  const { t } = useLocale();
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const sidebarTabletExpanded = useUiStore((s) => s.sidebarTabletExpanded);
  const toggleSidebarTabletExpanded = useUiStore(
    (s) => s.toggleSidebarTabletExpanded,
  );

  const isMdUp = useMediaQuery("(min-width: 768px)");
  const isLgUp = useMediaQuery("(min-width: 1024px)");

  const showNavLabels = isLgUp || sidebarTabletExpanded || !isMdUp;
  const isIconRail = isMdUp && !isLgUp && !sidebarTabletExpanded;
  /** Name + title when there is width; on mobile (`<md`) sidebar is overlay with room for the full user row. */
  const showSidebarUserFull = isLgUp || sidebarTabletExpanded || !isMdUp;

  const primaryNav = navItems.filter((item) =>
    canAccessPage({ role, permissions }, item.permission),
  );
  const canReadInbox = can({ role, permissions }, "inbox:read");
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  useEffect(() => {
    if (!authReady || !canReadInbox) {
      setUnreadInboxCount(0);
      return;
    }

    let cancelled = false;

    const loadUnread = async () => {
      try {
        const res = await fetch("/api/inbox/conversations?filter=unread&limit=50", {
          headers: buildAuthHeaders({
            apiSecret,
            idToken,
            tenantId,
            userId,
            role,
          }),
        });
        const json = (await res.json().catch(() => null)) as
          | {
              data?:
                | { conversations?: unknown[] }
                | unknown[];
            }
          | null;
        if (!res.ok || cancelled) return;
        const data = json?.data;
        const rows = Array.isArray(data)
          ? data
          : Array.isArray(data?.conversations)
            ? data.conversations
            : [];
        setUnreadInboxCount(rows.length);
      } catch {
        if (!cancelled) setUnreadInboxCount(0);
      }
    };

    void loadUnread();
    const timer = window.setInterval(() => {
      void loadUnread();
    }, 30000);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [
    authReady,
    canReadInbox,
    apiSecret,
    idToken,
    tenantId,
    userId,
    role,
  ]);

  const userNameLine = displayName?.trim() || userId || t("User");
  const userInitials =
    (userNameLine || "?")
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  async function onSignOut() {
    await supabaseClientSignOut();
    signOut();
    setMobileNavOpen(false);
    router.push("/login");
  }

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-e border-[color:var(--color-divider)] bg-[color:var(--color-shell)]",
        "transition-[width] duration-200 ease-out",
        isMdUp ? "sticky top-0" : "fixed inset-y-0 start-0 z-40 max-w-[88vw]",
        !isMdUp && !mobileNavOpen && "hidden",
        !isMdUp && mobileNavOpen && "flex",
        isMdUp && "flex",
        isLgUp && "w-[var(--app-sidebar-w)]",
        !isLgUp &&
          isMdUp &&
          (sidebarTabletExpanded ? "w-[var(--app-sidebar-w)]" : "w-[68px]"),
        !isMdUp && mobileNavOpen && "w-[min(288px,88vw)]",
      )}
      aria-label={t("Main navigation")}
      id="app-sidebar-nav"
    >
      <div
        className={cn(
          "flex shrink-0 flex-col gap-1.5 border-b border-[color:var(--color-divider)] py-3 pb-3",
          isIconRail ? "items-center px-2" : "px-[var(--app-sidebar-pad)]",
        )}
      >
        <Link
          href="/analytics"
          className={cn(
            "flex min-h-9 items-center rounded-[var(--ds-radius-md)] text-[color:var(--color-text-primary)] transition-colors hover:bg-[color:var(--color-hover-bg)]",
            isIconRail ? "justify-center px-0" : "gap-2 px-1.5",
          )}
          onClick={() => setMobileNavOpen(false)}
        >
          <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[var(--ds-radius-md)] bg-[color:var(--color-primary)]">
            <Image
              src="/brand-mark.png"
              alt=""
              width={32}
              height={32}
              className="size-8 object-cover"
              priority
            />
          </span>
          {showNavLabels ? (
            <span className="truncate text-[13px] font-semibold leading-tight tracking-tight text-[color:var(--color-text-primary)]">
              Store OMS
            </span>
          ) : null}
        </Link>
        {showNavLabels ? (
          <Link
            href="/settings"
            className="flex min-h-8 w-full items-center gap-2 rounded-[var(--ds-radius-md)] px-2 py-1 text-start text-[13px] text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]"
            onClick={() => setMobileNavOpen(false)}
          >
            <span className="min-w-0 flex-1 truncate font-medium text-[color:var(--color-text-primary)]">
              {tenantName?.trim() || t("Workspace")}
            </span>
            <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
          </Link>
        ) : null}
      </div>
      <nav
        className={cn(
          "flex flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-[var(--app-sidebar-pad)] pb-4 pt-2",
          isIconRail && "items-center px-2",
        )}
        aria-label={t("Primary")}
      >
        {primaryNav.map((item) => {
          const active = navActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={t(item.label)}
              className={cn(
                "relative flex min-h-8 items-center gap-2 rounded-[var(--ds-radius-md)] text-[13px] font-medium leading-snug transition-colors duration-100",
                isIconRail ? "w-9 justify-center px-0" : "px-2 py-1.5",
                active
                  ? "bg-[color:var(--color-sidebar-nav-active-bg)] text-[color:var(--color-sidebar-nav-active-fg)]"
                  : "text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]",
              )}
              onClick={() => setMobileNavOpen(false)}
            >
              <Icon
                className={cn(
                  "size-[18px] shrink-0 stroke-[1.75]",
                  active
                    ? "text-[color:var(--color-primary)]"
                    : "opacity-[0.85]",
                )}
                aria-hidden
              />
              <span className={cn(!showNavLabels && "sr-only")}>
                {t(item.label)}
              </span>
              {item.href === "/inbox" && unreadInboxCount > 0 ? (
                <span
                  className={cn(
                    "flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--color-error)] px-1.5 text-[10px] font-semibold leading-none text-white",
                    isIconRail ? "absolute end-0 top-0" : "ms-auto",
                  )}
                  aria-label={`${unreadInboxCount} unread inbox conversations`}
                >
                  {unreadInboxCount > 99 ? "99+" : unreadInboxCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div
        className={cn(
          "mt-auto flex flex-col gap-2 border-t border-[color:var(--color-divider)] p-[var(--app-sidebar-pad)] pb-4 pt-3",
          isIconRail && "items-center gap-2 px-2",
        )}
      >
        {isMdUp && !isLgUp ? (
          <button
            type="button"
            onClick={toggleSidebarTabletExpanded}
            className={cn(
              "flex min-h-8 items-center rounded-[var(--ds-radius-md)] text-[13px] text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)] focus-visible:shadow-[var(--shadow-focus-ring)] focus-visible:outline-none",
              isIconRail
                ? "w-9 justify-center"
                : "w-full justify-start gap-2 px-2 py-1.5",
            )}
            aria-expanded={sidebarTabletExpanded}
            aria-label={
              sidebarTabletExpanded ? t("Collapse sidebar") : t("Expand sidebar")
            }
          >
            {sidebarTabletExpanded ? (
              <PanelLeftClose className="size-[18px] shrink-0 opacity-90" aria-hidden />
            ) : (
              <PanelLeft className="size-[18px] shrink-0 opacity-90" aria-hidden />
            )}
            {showNavLabels ? (
              <span className="text-[13px] font-medium">
                {sidebarTabletExpanded ? "Collapse" : "Expand"}
              </span>
            ) : null}
          </button>
        ) : null}
        {showSidebarUserFull ? (
          <div className="flex w-full min-w-0 items-center gap-2.5 rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] px-2.5 py-2">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-shell)] text-[11px] font-semibold text-[color:var(--color-primary)] ring-1 ring-[color:var(--color-border)]"
              aria-hidden
            >
              {userInitials}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-medium leading-tight text-[color:var(--color-text-primary)]">
                {userNameLine}
              </p>
              <p className="truncate text-[11px] text-[color:var(--color-text-muted)]">
                {t(ROLE_TITLE[role] ?? role)}
              </p>
            </div>
          </div>
        ) : isIconRail ? (
          <div
            className="flex w-9 justify-center"
            title={`${userNameLine} - ${t(ROLE_TITLE[role] ?? role)}`}
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-muted-bg)] text-[11px] font-semibold text-[color:var(--color-primary)] ring-1 ring-[color:var(--color-border)]"
              aria-label={userNameLine}
            >
              {userInitials}
            </span>
          </div>
        ) : null}
        <a
          href="https://wa.me/+201069005019"
          className={cn(
            "flex min-h-8 items-center gap-2 rounded-[var(--ds-radius-md)] px-2 py-1.5 text-[13px] font-medium text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]",
            isIconRail && "w-9 justify-center px-0",
          )}
          title={t("Support")}
        >
          <HelpCircle className="size-[18px] shrink-0 opacity-90" aria-hidden />
          <span className={cn(!showNavLabels && "sr-only")}>{t("Support")}</span>
        </a>
        <button
          type="button"
          onClick={() => void onSignOut()}
          className={cn(
            "flex min-h-8 w-full items-center gap-2 rounded-[var(--ds-radius-md)] px-2 py-1.5 text-start text-[13px] font-medium text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)] focus-visible:shadow-[var(--shadow-focus-ring)] focus-visible:outline-none",
            isIconRail && "w-9 justify-center px-0",
          )}
        >
          <LogOut className="size-[18px] shrink-0 opacity-90" aria-hidden />
          <span className={cn(!showNavLabels && "sr-only")}>{t("Sign out")}</span>
        </button>
      </div>
    </aside>
  );
}
