import Link from "next/link";

export const metadata = {
  title: "Offline · Store OMS",
  description: "You are offline",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-[color:var(--color-bg)] p-6 text-center text-[color:var(--color-text-primary)]">
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">You are offline</h1>
        <p className="text-sm text-[color:var(--color-text-secondary)]">
          Check your connection, then try again. Cached pages may still open while offline.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-[var(--ds-radius-md)] bg-[color:var(--color-primary)] px-4 py-2.5 text-sm font-medium text-[color:var(--color-primary-contrast)] shadow-none hover:shadow-none"
      >
        Go to home
      </Link>
    </div>
  );
}
