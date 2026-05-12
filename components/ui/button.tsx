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
        "inline-flex items-center justify-center gap-1.5 rounded-[var(--ds-radius-md)] font-medium outline-none transition-colors duration-150",
        "disabled:pointer-events-none disabled:shadow-none",
        "disabled:bg-[color:var(--color-button-disabled-bg)] disabled:text-[color:var(--color-button-disabled-text)] disabled:opacity-100",
        "focus-visible:shadow-[var(--shadow-focus-ring)] focus-visible:ring-0",
        size === "sm" && "min-h-8 px-3 py-1.5 text-[13px] leading-5",
        size === "md" && "min-h-9 px-4 py-2 text-[13px] leading-5 sm:text-sm",
        size === "lg" && "min-h-10 px-5 py-2 text-sm leading-5",
        variant === "primary" &&
          "border-0 bg-[color:var(--color-primary)] text-[color:var(--color-primary-contrast)] hover:bg-[color:var(--color-primary-hover)] active:bg-[color:var(--color-primary-active)]",
        variant === "secondary" &&
          "border border-[color:var(--color-border)] bg-[color:var(--color-card)] text-[color:var(--color-text-primary)] shadow-none hover:bg-[color:var(--color-hover-bg)] active:bg-[color:var(--color-muted-bg)]",
        variant === "ghost" &&
          "border-0 bg-transparent text-[color:var(--color-text-secondary)] shadow-none hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]",
        variant === "danger" &&
          "border-0 bg-[color:var(--color-error)] text-[color:var(--color-primary-contrast)] hover:brightness-110 active:brightness-95",
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
