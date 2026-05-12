"use client";

import { cn } from "@/lib/ui/cn";

export function Switch({
  checked,
  onCheckedChange,
  id,
  disabled,
  "aria-labelledby": ariaLabelledby,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  id?: string;
  disabled?: boolean;
  "aria-labelledby"?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={ariaLabelledby}
      disabled={disabled}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-all duration-200",
        "ring-1 ring-inset ring-[color:var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]",
        "disabled:pointer-events-none disabled:opacity-50",
        checked
          ? "bg-[color:var(--color-primary)]"
          : "bg-[color:var(--color-bg-subtle)]",
      )}
      onClick={() => onCheckedChange(!checked)}
    >
      <span
        className={cn(
          "absolute top-1 size-5 rounded-full bg-[color:var(--color-card)] shadow-none transition-all duration-200",
          checked ? "end-1" : "start-1",
        )}
      />
    </button>
  );
}
