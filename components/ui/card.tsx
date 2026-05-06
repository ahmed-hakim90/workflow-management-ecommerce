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
          "rounded-xl border-0 bg-[color:var(--color-card)] shadow-[var(--shadow-notion-subtle)]",
        variant === "subtle" &&
          "rounded-lg border-0 bg-[color:var(--color-muted-bg)] shadow-none",
        variant === "feature" &&
          "rounded-lg border border-[color:var(--color-primary)] bg-[color:var(--color-surface-tint-blue)] shadow-none",
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
    <div className={cn("border-b border-[color:var(--color-divider)] px-6 py-3", className)}>
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
    <h3 className={cn("text-lg font-bold leading-7 text-[color:var(--color-text-primary)]", className)}>
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
  return <div className={cn("p-6", className)}>{children}</div>;
}
