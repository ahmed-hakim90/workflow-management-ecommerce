"use client";

import Link from "next/link";
import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useOrderAlertsStore } from "@/store/zustand/order-alerts-store";

const DISMISS_MS = 9000;

/**
 * Renders in-app toasts for new orders (the shell keeps this outside individual pages).
 */
export function NewOrderToasts() {
  const toasts = useOrderAlertsStore((s) => s.toasts);
  const dismiss = useOrderAlertsStore((s) => s.dismissToast);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50",
        "flex max-h-[50dvh] flex-col gap-2 px-3 md:bottom-auto md:top-20 md:start-auto md:end-4 md:ms-auto md:max-w-md md:pe-0",
        "pt-safe",
      )}
      aria-live="polite"
    >
      {toasts.map((t) => (
        <NewOrderToastRow key={t.toastId} t={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function NewOrderToastRow({
  t,
  onDismiss,
}: {
  t: { toastId: string; orderId: string; line1: string; line2: string };
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const h = setTimeout(() => onDismiss(t.toastId), DISMISS_MS);
    return () => clearTimeout(h);
  }, [t.toastId, onDismiss]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full min-w-0 max-w-md items-center gap-3 self-end",
        "rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-3.5 pr-2 shadow-none",
        "animate-in fade-in-0 duration-200 md:slide-in-from-top-2",
      )}
    >
      <div className="min-w-0 flex-1 text-start text-sm">
        <div className="font-medium text-[color:var(--color-text-primary)]">{t.line1}</div>
        <div className="text-[color:var(--color-text-secondary)]">{t.line2}</div>
      </div>
      <Link
        href={`/orders/${t.orderId}`}
        className="shrink-0 rounded-[var(--ds-radius-md)] bg-[color:var(--color-primary)] px-3 py-2 text-xs font-medium text-[color:var(--color-primary-foreground)] shadow-none hover:opacity-95"
      >
        فتح
      </Link>
      <button
        type="button"
        className="shrink-0 flex min-h-9 min-w-9 items-center justify-center rounded-[var(--ds-radius-md)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-elevated)]"
        aria-label="Dismiss"
        onClick={() => onDismiss(t.toastId)}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
