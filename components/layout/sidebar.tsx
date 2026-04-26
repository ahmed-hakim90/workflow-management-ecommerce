"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BarChart3,
  Package,
  LayoutGrid,
  Truck,
  Ticket,
  Settings,
  PanelLeftClose,
  PanelLeft,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useMediaQuery } from "@/lib/ui/use-media-query";
import { useUiStore } from "@/store/zustand/ui-store";
import { firebaseClientSignOut } from "@/lib/firebase/client-sign-out";
import { useSessionStore } from "@/store/zustand/session-store";

const navItems = [
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/orders/kanban", label: "Order board", icon: LayoutGrid },
  { href: "/shipments", label: "Shipments", icon: Truck },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function navActive(href: string, pathname: string) {
  if (href === "/orders") {
    if (pathname === "/orders/kanban") return false;
    return pathname === "/orders" || pathname.startsWith("/orders/");
  }
  if (href === "/orders/kanban") return pathname === "/orders/kanban";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = useSessionStore((s) => s.signOut);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const sidebarTabletExpanded = useUiStore((s) => s.sidebarTabletExpanded);
  const toggleSidebarTabletExpanded = useUiStore(
    (s) => s.toggleSidebarTabletExpanded,
  );

  const isMdUp = useMediaQuery("(min-width: 768px)");
  const isLgUp = useMediaQuery("(min-width: 1024px)");

  const showNavLabels = isLgUp || sidebarTabletExpanded;
  const isIconRail = isMdUp && !isLgUp && !sidebarTabletExpanded;

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  async function onSignOut() {
    await firebaseClientSignOut();
    signOut();
    setMobileNavOpen(false);
    router.push("/login");
  }

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-e border-[color:var(--color-divider)] bg-[color:var(--color-bg)]",
        "transition-[width] duration-200 ease-out",
        isMdUp ? "sticky top-0" : "fixed inset-y-0 start-0 z-40 max-w-[88vw]",
        !isMdUp && !mobileNavOpen && "hidden",
        !isMdUp && mobileNavOpen && "flex",
        isMdUp && "flex",
        isLgUp && "w-[240px]",
        !isLgUp &&
          isMdUp &&
          (sidebarTabletExpanded ? "w-[240px]" : "w-[72px]"),
        !isMdUp && mobileNavOpen && "w-[min(272px,88vw)]",
      )}
      aria-label="Main navigation"
      id="app-sidebar-nav"
    >
      <div
        className={cn(
          "flex shrink-0 flex-col gap-0.5 border-b border-[color:var(--color-divider)] py-3",
          isIconRail ? "items-center px-2" : "px-4",
        )}
      >
        <Link
          href="/analytics"
          className={cn(
            "flex min-h-11 items-center rounded-xl text-[color:var(--color-text-primary)] transition-shadow",
            isIconRail ? "justify-center" : "gap-2",
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
                <span className="truncate text-sm font-semibold">Hakimo OMS</span>
                <span className="truncate text-[11px] text-[color:var(--color-text-muted)]">
                  Order Management
                </span>
              </span>
            </>
          )}
        </Link>
      </div>
      <nav
        className={cn(
          "flex flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-3",
          isIconRail && "items-center px-2",
        )}
        aria-label="Primary"
      >
        {navItems.map((item) => {
          const active = navActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                isIconRail && "w-11 justify-center px-0",
                active
                  ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-contrast)] shadow-[var(--shadow-neo-raised-sm)]"
                  : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:shadow-[var(--shadow-neo-raised-sm)] active:shadow-[var(--shadow-neo-pressed-sm)]",
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
          "mt-auto border-t border-[color:var(--color-divider)] p-3",
          isIconRail && "flex flex-col items-center px-2",
        )}
      >
        {isMdUp && !isLgUp ? (
          <button
            type="button"
            onClick={toggleSidebarTabletExpanded}
            className={cn(
              "mb-2 flex min-h-11 items-center rounded-xl text-[color:var(--color-text-secondary)] hover:shadow-[var(--shadow-neo-raised-sm)] active:shadow-[var(--shadow-neo-pressed-sm)]",
              isIconRail
                ? "w-11 justify-center"
                : "w-full justify-start gap-2 px-3",
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
        <a
          href="mailto:support@hakimo.example"
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] transition-all hover:shadow-[var(--shadow-neo-raised-sm)]",
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
            "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] transition-all hover:shadow-[var(--shadow-neo-raised-sm)] active:shadow-[var(--shadow-neo-pressed-sm)]",
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
