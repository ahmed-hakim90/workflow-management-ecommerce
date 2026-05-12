"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Command } from "cmdk";
import {
  canAccessPage,
  type PagePermission,
} from "@/lib/auth/rbac";
import { useSessionStore } from "@/store/zustand/session-store";
import { useUiStore } from "@/store/zustand/ui-store";
import { useLocale } from "@/components/i18n/LocaleProvider";

type CommandItem = {
  href: string;
  label: string;
  permission: PagePermission;
  keywords?: string;
};

const NAV_COMMANDS: CommandItem[] = [
  { href: "/analytics", label: "Analytics", permission: "page:analytics" },
  { href: "/orders", label: "Orders", permission: "page:orders" },
  { href: "/customers", label: "Customers", permission: "page:orders" },
  { href: "/shipments", label: "Shipments", permission: "page:shipments" },
  { href: "/tickets", label: "Tickets", permission: "page:tickets" },
  { href: "/inbox", label: "Inbox", permission: "page:inbox", keywords: "chat whatsapp" },
  { href: "/warehouse", label: "Warehouse", permission: "page:warehouse" },
  { href: "/admin", label: "Admin", permission: "page:admin" },
  { href: "/users", label: "Users", permission: "page:users" },
  { href: "/settings", label: "Settings", permission: "page:settings" },
];

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const role = useSessionStore((s) => s.role);
  const permissions = useSessionStore((s) => s.permissions);
  const { t } = useLocale();

  const items = React.useMemo(() => {
    const subject = { role, permissions };
    return NAV_COMMANDS.filter((c) => canAccessPage(subject, c.permission));
  }, [role, permissions]);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[min(12vh,6rem)]">
      <button
        type="button"
        className="absolute inset-0 bg-[color:var(--color-overlay)] backdrop-blur-[1px]"
        aria-label={t("Close")}
        onClick={() => setOpen(false)}
      />
      <Command
        label={t("Quick navigation")}
        loop
        className="relative z-10 flex w-full max-w-[28rem] flex-col overflow-hidden rounded-[var(--ds-radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-[var(--shadow-notion-dropdown)]"
      >
        <div className="flex items-center gap-2 border-b border-[color:var(--color-divider)] px-2.5 py-2">
          <Search
            className="size-[17px] shrink-0 text-[color:var(--color-text-muted)]"
            aria-hidden
          />
          <Command.Input
            placeholder={t("Search pages…")}
            className="min-h-8 flex-1"
            autoFocus
            aria-label={t("Search pages…")}
          />
          <kbd className="hidden shrink-0 rounded border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--color-text-muted)] sm:inline">
            Esc
          </kbd>
        </div>
        <Command.List className="max-h-[min(360px,50vh)] overflow-y-auto p-1">
          <Command.Empty>{t("No matches")}</Command.Empty>
          {items.map((item) => (
            <Command.Item
              key={item.href}
              value={`${item.label} ${item.href} ${item.keywords ?? ""}`}
              onSelect={() => go(item.href)}
              className="flex cursor-pointer items-center px-2.5 py-2 text-start transition-colors"
            >
              {t(item.label)}
            </Command.Item>
          ))}
        </Command.List>
        <p className="border-t border-[color:var(--color-divider)] px-3 py-2 text-xs text-[color:var(--color-text-muted)]">
          {t("Keyboard shortcut")}: Ctrl/⌘ + K
        </p>
      </Command>
    </div>
  );
}
