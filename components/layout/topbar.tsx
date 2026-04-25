"use client";

import { useEffect, useState } from "react";
import { Bell, Menu, Search, UserCircle2, X } from "lucide-react";
import { useSessionStore } from "@/store/zustand/session-store";
import { cn } from "@/lib/ui/cn";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useMediaQuery } from "@/lib/ui/use-media-query";
import { useUiStore } from "@/store/zustand/ui-store";

export function Topbar() {
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const [mockOn, setMockOn] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const isMdUp = useMediaQuery("(min-width: 768px)");

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

  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center gap-2 border-b border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 md:gap-4 md:px-4",
      )}
    >
      <button
        type="button"
        className={cn(
          "flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)] md:hidden",
          mobileNavOpen && "bg-[color:var(--color-hover-bg)] text-[color:var(--color-text-primary)]",
        )}
        aria-expanded={mobileNavOpen}
        aria-controls="app-sidebar-nav"
        aria-label={mobileNavOpen ? "إغلاق القائمة" : "فتح القائمة"}
        onClick={() => setMobileNavOpen(!mobileNavOpen)}
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {mockOn ? (
        <span
          className="hidden shrink-0 rounded-md border border-[color:var(--color-dev-badge-border)] bg-[color:var(--color-dev-badge-bg)] px-2 py-1 text-[11px] font-medium text-[color:var(--color-dev-badge-text)] sm:inline"
          title="DEV_MOCK_DATA=true — لا يُستخدم Firestore"
        >
          وضع بيانات وهمية
        </span>
      ) : null}

      {isMdUp ? (
        <div className="relative min-w-0 max-w-md flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--color-text-secondary)]"
            aria-hidden
          />
          <input
            type="search"
            placeholder="بحث سريع…"
            className="h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] py-1.5 ps-9 pe-3 text-sm text-[color:var(--color-text-primary)] outline-none placeholder:text-[color:var(--color-text-secondary)] focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20"
            readOnly
            aria-label="بحث (قريباً)"
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
                  placeholder="بحث سريع…"
                  className="h-11 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] py-2 ps-9 pe-10 text-sm text-[color:var(--color-text-primary)] outline-none placeholder:text-[color:var(--color-text-secondary)] focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20"
                  readOnly
                  aria-label="بحث (قريباً)"
                  autoFocus
                />
              </div>
              <button
                type="button"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)]"
                aria-label="إغلاق البحث"
                onClick={() => setSearchOpen(false)}
              >
                <X className="size-5" aria-hidden />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)]"
              aria-label="بحث"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-5" aria-hidden />
            </button>
          )}
        </div>
      )}

      <div className="hidden items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-1 text-xs text-[color:var(--color-text-secondary)] md:flex">
        <span className="font-medium text-[color:var(--color-text-primary)]">Tenant</span>
        <span className="truncate font-mono">{tenantId}</span>
      </div>
      <button
        type="button"
        className="relative flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)]"
        aria-label="الإشعارات"
      >
        <Bell className="size-5" />
        <span className="absolute top-1.5 end-1.5 size-2 rounded-full bg-[color:var(--color-success)]" />
      </button>
      <ThemeToggle />
      <div className="flex min-h-11 items-center gap-2 rounded-lg border border-[color:var(--color-border)] px-2 py-1">
        <UserCircle2 className="size-8 shrink-0 text-[color:var(--color-text-secondary)]" aria-hidden />
        <div className="hidden text-start text-xs sm:block">
          <div className="font-medium text-[color:var(--color-text-primary)]">{userId}</div>
          <div className="text-[color:var(--color-text-secondary)]">{role}</div>
        </div>
      </div>
    </header>
  );
}
