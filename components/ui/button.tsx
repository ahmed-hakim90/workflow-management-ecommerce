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
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium outline-none transition-all duration-200",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]",
        size === "sm" &&
          "min-h-11 px-3 text-xs md:h-8 md:min-h-0 md:px-2.5",
        size === "md" &&
          "min-h-11 px-3.5 text-sm md:h-9 md:min-h-0",
        size === "lg" && "h-11 min-h-11 px-4 text-sm",
        variant === "primary" &&
          "border-0 bg-[color:var(--color-primary)] text-[color:var(--color-primary-contrast)] shadow-[var(--shadow-neo-raised-sm)] hover:bg-[color:var(--color-primary-hover)] active:shadow-[var(--shadow-neo-pressed-sm)]",
        variant === "secondary" &&
          "border-0 bg-[color:var(--color-card)] text-[color:var(--color-text-primary)] shadow-[var(--shadow-neo-raised-sm)] hover:shadow-[var(--shadow-neo-raised)] active:shadow-[var(--shadow-neo-pressed-sm)]",
        variant === "ghost" &&
          "text-[color:var(--color-text-secondary)] shadow-none hover:text-[color:var(--color-text-primary)] hover:shadow-[var(--shadow-neo-raised-sm)] active:shadow-[var(--shadow-neo-pressed-sm)]",
        variant === "danger" &&
          "border-0 bg-[color:var(--color-error)] text-[color:var(--color-primary-contrast)] shadow-[var(--shadow-neo-raised-sm)] hover:brightness-110 active:shadow-[var(--shadow-neo-pressed-sm)]",
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
