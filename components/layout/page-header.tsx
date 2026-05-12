import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-8 flex flex-col gap-3 sm:mb-9 sm:flex-row sm:items-start sm:justify-between sm:gap-5 md:mb-10",
        className,
      )}
    >
      <div className="max-w-[var(--app-prose-max-w)] space-y-2">
        {breadcrumb}
        <h1 className="text-[clamp(1.2rem,2.4vw,1.625rem)] font-semibold leading-snug tracking-tight text-[color:var(--color-text-primary)]">
          {title}
        </h1>
        {description ? (
          <p className="text-[13px] font-normal leading-relaxed text-[color:var(--color-text-secondary)] sm:text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
