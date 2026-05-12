import Link from "next/link";
import { cn } from "@/lib/ui/cn";

const linkBtn =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--ds-radius-md)] px-3.5 text-sm font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)] md:h-9 md:min-h-0";

export function UnauthenticatedBanner() {
  return (
    <div
      className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-divider)] bg-[color:var(--color-elevated)] p-5 shadow-none"
      role="status"
    >
      <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
        Sign in to view this page
      </p>
      <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
        Use Supabase sign-in or add a staff API key in Settings after you sign in.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/login"
          className={cn(
            linkBtn,
            "border-0 bg-[color:var(--color-primary)] text-[color:var(--color-primary-contrast)] shadow-none hover:bg-[color:var(--color-primary-hover)]",
          )}
        >
          Go to login
        </Link>
        <Link
          href="/settings"
          className={cn(
            linkBtn,
            "border border-[color:var(--color-border)] bg-[color:var(--color-card)] text-[color:var(--color-text-primary)] shadow-none hover:bg-[color:var(--color-hover-bg)]",
          )}
        >
          Open settings
        </Link>
      </div>
    </div>
  );
}
