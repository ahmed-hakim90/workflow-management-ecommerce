import { cn } from "@/lib/ui/cn";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-10 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-start sm:justify-between sm:gap-6 md:mb-14",
        className,
      )}
    >
      <div className="max-w-[var(--app-prose-max-w)] space-y-3">
        <h1 className="text-2xl font-bold leading-8 tracking-tight text-[color:var(--color-text-primary)] sm:text-[28px] sm:leading-9 md:text-[32px] md:leading-10">
          {title}
        </h1>
        {description ? (
          <p className="text-base font-normal leading-6 text-[color:var(--color-text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
