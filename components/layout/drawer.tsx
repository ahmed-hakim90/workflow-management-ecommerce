"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useUiStore } from "@/store/zustand/ui-store";
import { cn } from "@/lib/ui/cn";

export function AppDrawer() {
  const drawerOpen = useUiStore((s) => s.drawerOpen);
  const drawerTitle = useUiStore((s) => s.drawerTitle);
  const drawerRender = useUiStore((s) => s.drawerRender);
  const closeDrawer = useUiStore((s) => s.closeDrawer);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-[color:var(--color-overlay)] backdrop-blur-[1px]"
        aria-label="إغلاق اللوحة"
        onClick={closeDrawer}
      />
      <div
        className={cn(
          "absolute inset-y-0 end-0 flex w-full max-w-none flex-col border-s border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-xl motion-reduce:transition-none md:max-w-md",
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-[color:var(--color-border)] px-4">
          <h2 className="truncate text-sm font-semibold text-[color:var(--color-text-primary)]">
            {drawerTitle}
          </h2>
          <button
            type="button"
            className="rounded-lg p-2 text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)]"
            onClick={closeDrawer}
            aria-label="إغلاق"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {drawerRender ? drawerRender() : null}
        </div>
      </div>
    </div>
  );
}
