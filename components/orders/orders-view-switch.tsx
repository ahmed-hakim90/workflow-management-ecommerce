"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useLocale } from "@/components/i18n/LocaleProvider";

export function OrdersViewSwitch({ className }: { className?: string }) {
  const pathname = usePathname();
  const isBoard = pathname === "/orders/kanban";
  const { t } = useLocale();

  return (
    <div
      className={cn(
        "inline-flex rounded-xl bg-[color:var(--color-bg-subtle)] p-1 shadow-[var(--shadow-neo-inset)]",
        className,
      )}
      role="group"
      aria-label={t("Orders view")}
    >
      <Link
        href="/orders"
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
          !isBoard
            ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-contrast)] shadow-[var(--shadow-neo-raised-sm)]"
            : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:shadow-[var(--shadow-neo-raised-sm)]",
        )}
      >
        <List className="size-4 shrink-0" aria-hidden />
        {t("List")}
      </Link>
      <Link
        href="/orders/kanban"
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
          isBoard
            ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-contrast)] shadow-[var(--shadow-neo-raised-sm)]"
            : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:shadow-[var(--shadow-neo-raised-sm)]",
        )}
      >
        <LayoutGrid className="size-4 shrink-0" aria-hidden />
        {t("Board")}
      </Link>
    </div>
  );
}
