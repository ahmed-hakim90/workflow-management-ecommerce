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
        "mb-7 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-5",
        className,
      )}
    >
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-text-primary)] md:text-2xl lg:text-[24px]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-[13px] text-[color:var(--color-text-secondary)] md:text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5 sm:gap-3">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
