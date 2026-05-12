"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useLocale } from "@/components/i18n/LocaleProvider";

export type BreadcrumbSegment = { label: string; href?: string };

export function AppBreadcrumb({
  segments,
  className,
  variant = "default",
}: {
  segments: BreadcrumbSegment[];
  className?: string;
  /** `inline`: single row in top bar (truncate current segment). */
  variant?: "default" | "inline";
}) {
  const { t } = useLocale();
  if (segments.length === 0) return null;

  return (
    <nav
      aria-label={t("Breadcrumb")}
      className={cn(variant === "inline" ? "mb-0" : "mb-1", className)}
    >
      <ol
        className={cn(
          "flex items-center gap-x-1 text-[12px] text-[color:var(--color-text-muted)]",
          variant === "inline"
            ? "min-w-0 flex-nowrap overflow-hidden"
            : "flex-wrap gap-y-0.5",
        )}
      >
        {segments.map((seg, i) => {
          const last = i === segments.length - 1;
          return (
            <li
              key={`${seg.label}-${i}`}
              className={cn(
                "flex items-center gap-1",
                variant === "inline" && last && "min-w-0 flex-1",
              )}
            >
              {i > 0 ? (
                <ChevronRight
                  className="size-3 shrink-0 opacity-40 rtl:rotate-180"
                  aria-hidden
                />
              ) : null}
              {last || !seg.href ? (
                <span
                  className={cn(
                    last && "font-medium text-[color:var(--color-text-primary)]",
                    variant === "inline" && last && "min-w-0 truncate",
                  )}
                >
                  {seg.label}
                </span>
              ) : (
                <Link
                  href={seg.href}
                  className="transition-colors hover:text-[color:var(--color-text-primary)]"
                >
                  {seg.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
