"use client";

import { cn } from "@/lib/ui/cn";

export type TabItem = {
  id: string;
  label: string;
};

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-1",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-contrast)]"
                : "text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
