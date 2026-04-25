import { Loader2 } from "lucide-react";
import { cn } from "@/lib/ui/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium outline-none transition-all duration-200",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]/30",
        size === "sm" &&
          "min-h-11 px-3 text-xs md:h-8 md:min-h-0 md:px-2.5",
        size === "md" &&
          "min-h-11 px-3.5 text-sm md:h-9 md:min-h-0",
        size === "lg" && "h-11 min-h-11 px-4 text-sm",
        variant === "primary" &&
          "bg-[color:var(--color-primary)] text-[color:var(--color-primary-contrast)] hover:bg-[color:var(--color-primary-hover)]",
        variant === "secondary" &&
          "border border-[color:var(--color-border)] bg-[color:var(--color-card)] text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-hover-bg)]",
        variant === "ghost" &&
          "text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]",
        variant === "danger" &&
          "bg-[color:var(--color-error)] text-[color:var(--color-primary-contrast)] hover:brightness-110",
        className,
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
