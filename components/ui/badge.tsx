import { cn } from "@/lib/ui/cn";

const tones = {
  default:
    "bg-[color:var(--color-muted-bg)] text-[color:var(--color-text-secondary)] ring-[color:var(--color-border)]",
  success:
    "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] ring-[color:var(--color-success)]/30",
  warning:
    "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)] ring-[color:var(--color-warning)]/30",
  danger:
    "bg-[color:var(--color-error)]/15 text-[color:var(--color-error)] ring-[color:var(--color-error)]/30",
  info: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)] ring-[color:var(--color-info)]/30",
} as const;

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
