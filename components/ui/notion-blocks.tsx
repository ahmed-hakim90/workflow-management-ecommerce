import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

/** Stacked property rows (Notion database page / properties panel). */
export function NotionPropertyList({
  children,
  className,
  variant = "plain",
}: {
  children: ReactNode;
  className?: string;
  variant?: "plain" | "panel";
}) {
  return (
    <div
      className={cn(
        variant === "panel" &&
          "rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 sm:px-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Label above value — for dense grids (e.g. 2×2 finance cells). */
export function NotionPropertyField({
  name,
  children,
  className,
}: {
  name: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <div className="text-[12px] font-medium leading-5 text-[color:var(--color-text-muted)]">
        {name}
      </div>
      <div className="text-[14px] font-normal leading-snug text-[color:var(--color-text-primary)]">
        {children}
      </div>
    </div>
  );
}

/** One property: muted label + primary value (responsive two-column layout). */
export function NotionPropertyRow({
  name,
  children,
  className,
}: {
  name: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-1 border-b border-[color:var(--color-divider)] py-2.5 last:border-b-0 sm:grid-cols-[minmax(7rem,12rem)_1fr] sm:items-start sm:gap-x-4 sm:gap-y-0",
        className,
      )}
    >
      <div className="text-[12px] font-medium leading-5 text-[color:var(--color-text-muted)] sm:pt-px">
        {name}
      </div>
      <div className="min-w-0 text-[14px] font-normal leading-snug text-[color:var(--color-text-primary)]">
        {children}
      </div>
    </div>
  );
}

/** Section title above a block of content (Notion “toggle” / heading rhythm). */
export function NotionSectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "mb-2 text-[13px] font-semibold text-[color:var(--color-text-primary)]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

type CalloutTone = "default" | "info" | "success" | "warning";

const CALLOUT_STYLES: Record<
  CalloutTone,
  { bg: string; border: string; icon?: string }
> = {
  default: {
    bg: "bg-[color:var(--color-muted-bg)]",
    border: "border-[color:var(--color-border)]",
  },
  info: {
    bg: "bg-[color:var(--color-surface-tint-blue)]",
    border: "border-[color:var(--color-primary)]/30",
  },
  success: {
    bg: "bg-[color:var(--color-callout-success-bg)]",
    border: "border-[color:var(--color-callout-success-border)]",
  },
  warning: {
    bg: "bg-[color:var(--color-callout-warning-bg)]",
    border: "border-[color:var(--color-callout-warning-border)]",
  },
};

export function NotionCallout({
  icon,
  children,
  tone = "default",
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: CalloutTone;
  className?: string;
}) {
  const s = CALLOUT_STYLES[tone];
  return (
    <div
      className={cn(
        "flex gap-3 rounded-[var(--ds-radius-md)] border px-3 py-2.5 text-[13px] leading-relaxed text-[color:var(--color-text-primary)] shadow-none",
        s.bg,
        s.border,
        className,
      )}
    >
      {icon ? (
        <span className="mt-0.5 shrink-0 text-[color:var(--color-text-secondary)]">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
