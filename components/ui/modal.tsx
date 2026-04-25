"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[color:var(--color-overlay)] backdrop-blur-[1px]"
        aria-label="إغلاق"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-xl",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">{title}</h2>
          <button
            type="button"
            className="rounded-lg p-1.5 text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)]"
            onClick={onClose}
            aria-label="إغلاق"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer ? (
          <div className="border-t border-[color:var(--color-border)] px-4 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
