"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BarChart3,
  Package,
  Truck,
  Ticket,
  Settings,
  PanelLeftClose,
  PanelLeft,
  HelpCircle,
  LogOut,
  Warehouse,
  Users,
  Shield,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useMediaQuery } from "@/lib/ui/use-media-query";
import { useUiStore } from "@/store/zustand/ui-store";
import { firebaseClientSignOut } from "@/lib/firebase/client-sign-out";
import { useSessionStore } from "@/store/zustand/session-store";
import { canAccessPage, type PagePermission } from "@/lib/auth/rbac";
import { useLocale } from "@/components/i18n/LocaleProvider";

const navItems: {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: PagePermission;
}[] = [
  { href: "/analytics", label: "Analytics", icon: BarChart3, permission: "page:analytics" },
  { href: "/orders", label: "Orders", icon: Package, permission: "page:orders" },
  { href: "/shipments", label: "Shipments", icon: Truck, permission: "page:shipments" },
  { href: "/tickets", label: "Tickets", icon: Ticket, permission: "page:tickets" },
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

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  const userNameLine = displayName?.trim() || userId || t("User");
  const userInitials =
    (userNameLine || "?")
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  async function onSignOut() {
    await firebaseClientSignOut();
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
          (sidebarTabletExpanded ? "w-[var(--app-sidebar-w)]" : "w-[72px]"),
        !isMdUp && mobileNavOpen && "w-[min(288px,88vw)]",
      )}
      aria-label={t("Main navigation")}
      id="app-sidebar-nav"
    >
      <div
        className={cn(
          "flex shrink-0 flex-col gap-2 border-b border-[color:var(--color-divider)] py-4 pb-4",
          isIconRail ? "items-center px-2" : "px-[var(--app-sidebar-pad)]",
        )}
      >
        <Link
          href="/analytics"
          className={cn(
            "flex min-h-11 items-center rounded-lg text-[color:var(--color-text-primary)] transition-colors hover:bg-[color:var(--color-hover-bg)]",
            isIconRail ? "justify-center px-0" : "gap-2 px-2",
          )}
          onClick={() => setMobileNavOpen(false)}
        >
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[color:var(--color-primary)]">
            <Image
              src="/brand-mark.png"
              alt=""
              width={36}
              height={36}
              className="size-9 object-cover"
              priority
            />
          </span>
          {showNavLabels ? (
            <span className="truncate text-sm font-semibold text-[color:var(--color-text-primary)]">
              Store OMS
            </span>
          ) : null}
        </Link>
        {showNavLabels ? (
          <Link
            href="/settings"
            className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]"
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
          "flex flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-[var(--app-sidebar-pad)] pb-5 pt-3",
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
                "flex min-h-11 items-center gap-2 rounded-lg text-base font-normal leading-6 transition-colors duration-150",
                isIconRail ? "w-11 justify-center px-0" : "px-4 py-2",
                active
                  ? "bg-[color:var(--color-sidebar-nav-active-bg)] text-[color:var(--color-sidebar-nav-active-fg)]"
                  : "text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]",
              )}
              onClick={() => setMobileNavOpen(false)}
            >
              <Icon
                className={cn(
                  "size-5 shrink-0",
                  active
                    ? "text-[color:var(--color-sidebar-nav-active-fg)]"
                    : "opacity-90",
                )}
                aria-hidden
              />
              <span className={cn(!showNavLabels && "sr-only")}>
                {t(item.label)}
              </span>
            </Link>
          );
        })}
      </nav>
      <div
        className={cn(
          "mt-auto flex flex-col gap-3.5 border-t border-[color:var(--color-divider)] p-[var(--app-sidebar-pad)] pb-5 pt-4",
          isIconRail && "items-center gap-3.5 px-2",
        )}
      >
        {isMdUp && !isLgUp ? (
          <button
            type="button"
            onClick={toggleSidebarTabletExpanded}
            className={cn(
              "flex min-h-11 items-center rounded-lg text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)] focus-visible:shadow-[var(--shadow-focus-ring)] focus-visible:outline-none",
              isIconRail
                ? "w-11 justify-center"
                : "w-full justify-start gap-2 px-4 py-2",
            )}
            aria-expanded={sidebarTabletExpanded}
            aria-label={
              sidebarTabletExpanded ? t("Collapse sidebar") : t("Expand sidebar")
            }
          >
            {sidebarTabletExpanded ? (
              <PanelLeftClose className="size-5 shrink-0" aria-hidden />
            ) : (
              <PanelLeft className="size-5 shrink-0" aria-hidden />
            )}
            {showNavLabels ? (
              <span className="text-sm font-medium">
                {sidebarTabletExpanded ? "Collapse" : "Expand"}
              </span>
            ) : null}
          </button>
        ) : null}
        {showSidebarUserFull ? (
          <div className="flex w-full min-w-0 items-center gap-3 rounded-lg bg-[color:var(--color-muted-bg)] px-3 py-2.5">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-muted-bg)] text-xs font-semibold text-[color:var(--color-primary)]"
              aria-hidden
            >
              {userInitials}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium text-[color:var(--color-text-primary)]">
                {userNameLine}
              </p>
              <p className="truncate text-[11px] text-[color:var(--color-text-muted)]">
                {t(ROLE_TITLE[role] ?? role)}
              </p>
            </div>
          </div>
        ) : isIconRail ? (
          <div
            className="flex w-11 justify-center"
            title={`${userNameLine} - ${t(ROLE_TITLE[role] ?? role)}`}
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-muted-bg)] text-[11px] font-semibold text-[color:var(--color-primary)]"
              aria-label={userNameLine}
            >
              {userInitials}
            </span>
          </div>
        ) : null}
        <a
          href="https://wa.me/+201069005019"
          className={cn(
            "flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-base font-normal text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]",
            isIconRail && "w-11 justify-center px-0",
          )}
          title={t("Support")}
        >
          <HelpCircle className="size-5 shrink-0" aria-hidden />
          <span className={cn(!showNavLabels && "sr-only")}>{t("Support")}</span>
        </a>
        <button
          type="button"
          onClick={() => void onSignOut()}
          className={cn(
            "flex min-h-11 w-full items-center gap-2 rounded-lg px-4 py-2 text-start text-base font-normal text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)] focus-visible:shadow-[var(--shadow-focus-ring)] focus-visible:outline-none",
            isIconRail && "w-11 justify-center px-0",
          )}
        >
          <LogOut className="size-5 shrink-0" aria-hidden />
          <span className={cn(!showNavLabels && "sr-only")}>{t("Sign out")}</span>
        </button>
      </div>
    </aside>
  );
}
