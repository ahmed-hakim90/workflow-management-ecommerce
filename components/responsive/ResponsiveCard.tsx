import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function ResponsiveCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
