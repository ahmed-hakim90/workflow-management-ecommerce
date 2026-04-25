"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-[color:var(--color-overlay)]"
        onClick={onClose}
        aria-label="close"
      />
      <aside
        className={cn(
          "absolute inset-y-0 end-0 w-full max-w-md border-s border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-2xl",
          "animate-in slide-in-from-right duration-200",
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex h-14 items-center justify-between border-b border-[color:var(--color-border)] px-4">
          <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">{title}</h2>
          <button
            className="rounded-md p-1.5 text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)]"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="h-[calc(100%-56px)] overflow-auto p-4">{children}</div>
      </aside>
    </div>
  );
}
