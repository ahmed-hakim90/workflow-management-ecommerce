import { cn } from "@/lib/ui/cn";

export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto min-h-0 w-full max-w-[var(--app-content-max-w)] flex-1 overflow-auto px-4 py-6 pb-safe sm:px-6 sm:py-8 md:px-6 md:py-10 lg:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
