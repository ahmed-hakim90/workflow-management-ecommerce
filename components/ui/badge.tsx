import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/ui/cn";

const tones = {
  default: "bg-[color:var(--color-muted-bg)] text-[color:var(--color-text-primary)]",
  success:
    "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
  warning:
    "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
  danger: "bg-[color:var(--color-error)]/15 text-[color:var(--color-error)]",
  info: "bg-[color:var(--color-surface-tint-blue)] text-[color:var(--color-primary-hover)]",
  agentTask:
    "bg-[color:var(--color-accent-purple)]/15 text-[color:var(--color-accent-purple)]",
  agentReport:
    "bg-[color:var(--color-accent-teal)]/15 text-[color:var(--color-accent-teal)]",
  agentQa:
    "bg-[color:var(--color-accent-orange)]/15 text-[color:var(--color-accent-orange)]",
} as const;

export type BadgeProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  children: React.ReactNode;
  tone?: keyof typeof tones;
};

export function Badge({ children, tone = "default", className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium leading-4",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
