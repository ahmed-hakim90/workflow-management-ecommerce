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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useMediaQuery } from "@/lib/ui/use-media-query";
import { useUiStore } from "@/store/zustand/ui-store";
import { firebaseClientSignOut } from "@/lib/firebase/client-sign-out";
import { useSessionStore } from "@/store/zustand/session-store";
import { can } from "@/lib/auth/rbac";
import type { UserRole } from "@/lib/types/models";

const navItems: {
  href: string;
  label: string;
  icon: LucideIcon;
  show: (role: UserRole) => boolean;
}[] = [
  { href: "/analytics", label: "Analytics", icon: BarChart3, show: () => true },
  { href: "/orders", label: "Orders", icon: Package, show: () => true },
  { href: "/shipments", label: "Shipments", icon: Truck, show: () => true },
  { href: "/tickets", label: "Tickets", icon: Ticket, show: () => true },
  {
    href: "/warehouse",
    label: "Warehouse",
    icon: Warehouse,
    show: (r) => can(r, "shipment:scan"),
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Shield,
    show: (r) => r === "admin" || r === "moderator",
  },
  {
    href: "/users",
    label: "Users",
    icon: Users,
    show: (r) => can(r, "user:read"),
  },
  { href: "/settings", label: "Settings", icon: Settings, show: () => true },
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

  const primaryNav = navItems.filter((item) => item.show(role));

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  const userNameLine = displayName?.trim() || userId || "User";
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
      aria-label="Main navigation"
      id="app-sidebar-nav"
    >
      <div
        className={cn(
          "flex shrink-0 flex-col gap-1 border-b border-[color:var(--color-divider)] py-4 pb-5",
          isIconRail ? "items-center px-2" : "px-[var(--app-sidebar-pad)]",
        )}
      >
        <Link
          href="/analytics"
          className={cn(
            "flex min-h-11 items-center rounded-xl text-[color:var(--color-text-primary)] transition-shadow",
            isIconRail ? "justify-center" : "gap-3",
          )}
          onClick={() => setMobileNavOpen(false)}
        >
          {isIconRail ? (
            <span className="flex size-9 items-center justify-center overflow-hidden rounded-xl bg-[color:var(--color-primary)] shadow-[var(--shadow-neo-raised-sm)]">
              <Image
                src="/brand-mark.png"
                alt=""
                width={36}
                height={36}
                className="size-9 object-cover"
                priority
              />
            </span>
          ) : (
            <>
              <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[color:var(--color-primary)] shadow-[var(--shadow-neo-raised-sm)]">
                <Image
                  src="/brand-mark.png"
                  alt=""
                  width={36}
                  height={36}
                  className="size-9 object-cover"
                  priority
                />
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-semibold text-[color:var(--color-primary)]">
                  Store OMS
                </span>
                <span className="truncate text-[11px] text-[color:var(--color-text-muted)]">
                  {tenantName?.trim() || "Order Management"}
                </span>
              </span>
            </>
          )}
        </Link>
      </div>
      <nav
        className={cn(
          "flex flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-[var(--app-sidebar-pad)] pb-5 pt-1",
          isIconRail && "items-center gap-3 px-2",
        )}
        aria-label="Primary"
      >
        {primaryNav.map((item) => {
          const active = navActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-all duration-200",
                isIconRail && "w-11 justify-center px-0",
                active
                  ? "border-s-[3px] border-[color:var(--color-primary)] bg-[color:var(--color-nav-active-bg)] text-[color:var(--color-primary)] shadow-none"
                  : "border-s-[3px] border-transparent text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]",
              )}
              onClick={() => setMobileNavOpen(false)}
            >
              <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
              <span className={cn(!showNavLabels && "sr-only")}>
                {item.label}
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
              "flex min-h-12 items-center rounded-xl text-[color:var(--color-text-secondary)] hover:shadow-[var(--shadow-neo-raised-sm)] active:shadow-[var(--shadow-neo-pressed-sm)]",
              isIconRail
                ? "w-11 justify-center"
                : "w-full justify-start gap-2.5 px-3.5",
            )}
            aria-expanded={sidebarTabletExpanded}
            aria-label={
              sidebarTabletExpanded ? "Collapse sidebar" : "Expand sidebar"
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
          <div className="flex w-full min-w-0 items-center gap-3 rounded-xl bg-[color:var(--color-bg-subtle)]/70 px-2.5 py-2.5">
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
                {ROLE_TITLE[role] ?? role}
              </p>
            </div>
          </div>
        ) : isIconRail ? (
          <div
            className="flex w-11 justify-center"
            title={`${userNameLine} — ${ROLE_TITLE[role] ?? role}`}
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
          href="mailto:support@Store.example"
          className={cn(
            "flex min-h-12 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[color:var(--color-text-secondary)] transition-all hover:shadow-[var(--shadow-neo-raised-sm)]",
            isIconRail && "w-11 justify-center px-0",
          )}
          title="Support"
        >
          <HelpCircle className="size-4 shrink-0" aria-hidden />
          <span className={cn(!showNavLabels && "sr-only")}>Support</span>
        </a>
        <button
          type="button"
          onClick={() => void onSignOut()}
          className={cn(
            "flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[color:var(--color-text-secondary)] transition-all hover:shadow-[var(--shadow-neo-raised-sm)] active:shadow-[var(--shadow-neo-pressed-sm)]",
            isIconRail && "w-11 justify-center px-0",
          )}
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          <span className={cn(!showNavLabels && "sr-only")}>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
