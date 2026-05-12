import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function ResponsiveCard({
  className,
  children,
  onClick,
}: {
  className?: string;
  children: ReactNode;
  /** When set, card is keyboard-activatable and shows pointer cursor. */
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        "w-full rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-none",
        onClick && "cursor-pointer transition-colors hover:bg-[color:var(--color-hover-bg)]",
        className,
      )}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
