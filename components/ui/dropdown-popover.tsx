"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/ui/cn";

type AnchoredDropdownProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
  /** Panel min width in px */
  width?: number;
};

/**
 * Fixed dropdown under anchor; click-outside + Escape close.
 * Position uses viewport coords; RTL aligns panel to trigger inline start.
 */
export function AnchoredDropdown({
  open,
  onClose,
  anchorRef,
  children,
  className,
  width = 280,
}: AnchoredDropdownProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [style, setStyle] = React.useState<React.CSSProperties>({});

  const updatePosition = React.useCallback(() => {
    const el = anchorRef.current;
    if (!el || !open) return;
    const rect = el.getBoundingClientRect();
    const isRtl = document.documentElement.getAttribute("dir") === "rtl";
    const margin = 8;
    const w = Math.min(width, window.innerWidth - margin * 2);
    let left = isRtl ? rect.right - w : rect.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
    const top = rect.bottom + margin;
    setStyle({
      position: "fixed",
      top,
      left,
      width: w,
      maxHeight: `min(420px, calc(100vh - ${top + margin}px))`,
      zIndex: 50,
    });
  }, [anchorRef, open, width]);

  React.useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose, anchorRef]);

  React.useEffect(() => {
    if (!open || !panelRef.current) return;
    const idle = window.requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(idle);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40 bg-transparent"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "overflow-y-auto rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-2 shadow-[var(--shadow-notion-dropdown)] outline-none",
          className,
        )}
        style={style}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
