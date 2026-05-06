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
      role="tablist"
      className={cn(
        "flex h-12 border-b border-[color:var(--color-bg)] bg-[color:var(--color-card)]",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-3 text-sm transition-colors duration-200",
              active
                ? "border-[color:var(--color-primary)] font-semibold text-[color:var(--color-text-primary)]"
                : "border-transparent font-medium text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
