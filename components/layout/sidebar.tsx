"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Package,
  Columns3,
  Warehouse,
  Ticket,
  Users,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useMediaQuery } from "@/lib/ui/use-media-query";
import { useUiStore } from "@/store/zustand/ui-store";

const navItems = [
  { href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/orders", label: "الطلبات", icon: Package },
  { href: "/orders/kanban", label: "Kanban", icon: Columns3 },
  { href: "/warehouse", label: "المخزن", icon: Warehouse },
  { href: "/tickets", label: "التذاكر", icon: Ticket },
  { href: "/users", label: "المستخدمون", icon: Users },
  { href: "/analytics", label: "التحليلات", icon: BarChart3 },
  { href: "/settings", label: "الإعدادات", icon: Settings },
] as const;

function navActive(href: string, pathname: string) {
  if (href === "/orders") return pathname === "/orders";
  if (href === "/orders/kanban") return pathname.startsWith("/orders/kanban");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
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

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-s border-[color:var(--color-border)] bg-[color:var(--color-card)]",
        "transition-[width] duration-200 ease-out",
        isMdUp ? "sticky top-0" : "fixed inset-y-0 z-40 max-w-[88vw]",
        !isMdUp && !mobileNavOpen && "hidden",
        !isMdUp && mobileNavOpen && "flex",
        isMdUp && "flex",
        isLgUp && "w-[240px]",
        !isLgUp &&
          isMdUp &&
          (sidebarTabletExpanded ? "w-[240px]" : "w-[72px]"),
        !isMdUp && mobileNavOpen && "w-[min(272px,88vw)]",
      )}
      aria-label="التنقل الرئيسي"
      id="app-sidebar-nav"
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-[color:var(--color-border)]",
          isIconRail ? "justify-center px-2" : "px-4",
        )}
      >
        <Link
          href="/dashboard"
          className={cn(
            "flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sm font-semibold text-[color:var(--color-text-primary)]",
            !isIconRail && "w-full justify-start gap-2",
          )}
          onClick={() => setMobileNavOpen(false)}
        >
          {isIconRail ? (
            <span className="flex size-9 items-center justify-center rounded-md bg-[color:var(--color-primary)] text-xs font-bold text-[color:var(--color-primary-contrast)]">
              H
            </span>
          ) : (
            <span className="truncate">Hakimo OMS</span>
          )}
        </Link>
      </div>
      <nav
        className={cn(
          "flex flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-3",
          isIconRail && "items-center px-2",
        )}
        aria-label="القائمة الرئيسية"
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
                "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isIconRail && "w-11 justify-center px-0",
                active
                  ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-contrast)]"
                  : "text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]",
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
          "mt-auto border-t border-[color:var(--color-border)] p-3",
          isIconRail && "flex flex-col items-center px-2",
        )}
      >
        {isMdUp && !isLgUp ? (
          <button
            type="button"
            onClick={toggleSidebarTabletExpanded}
            className={cn(
              "mb-2 flex min-h-11 items-center rounded-lg text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)]",
              isIconRail
                ? "w-11 justify-center"
                : "w-full justify-start gap-2 px-3",
            )}
            aria-expanded={sidebarTabletExpanded}
            aria-label={
              sidebarTabletExpanded ? "طي الشريط الجانبي" : "توسيع الشريط الجانبي"
            }
          >
            {sidebarTabletExpanded ? (
              <PanelLeftClose className="size-5 shrink-0" aria-hidden />
            ) : (
              <PanelLeft className="size-5 shrink-0" aria-hidden />
            )}
            {showNavLabels ? (
              <span className="text-sm font-medium">
                {sidebarTabletExpanded ? "تصغير" : "توسيع"}
              </span>
            ) : null}
          </button>
        ) : null}
        <Link
          href="/admin"
          title="إدارة متقدمة"
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isIconRail && "w-11 justify-center px-0",
            pathname === "/admin"
              ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-contrast)]"
              : "text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)]",
          )}
          onClick={() => setMobileNavOpen(false)}
        >
          <BarChart3 className="size-4 shrink-0" aria-hidden />
          <span className={cn(!showNavLabels && "sr-only")}>إدارة متقدمة</span>
        </Link>
      </div>
    </aside>
  );
}
