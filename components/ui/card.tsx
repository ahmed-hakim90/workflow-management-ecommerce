import { cn } from "@/lib/ui/cn";

export function Card({
  className,
  variant = "default",
  children,
}: {
  className?: string;
  variant?: "default" | "subtle" | "feature";
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        variant === "default" &&
          "rounded-[var(--ds-radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-none",
        variant === "subtle" &&
          "rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] shadow-none",
        variant === "feature" &&
          "rounded-[var(--ds-radius-md)] border border-[color:var(--color-primary)]/35 bg-[color:var(--color-surface-tint-blue)] shadow-none",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("border-b border-[color:var(--color-divider)] px-4 py-2.5 sm:px-5", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className={cn("text-[15px] font-semibold leading-snug text-[color:var(--color-text-primary)]", className)}>
      {children}
    </h3>
  );
}

export function CardContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>;
}
