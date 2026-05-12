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
        "mx-auto min-h-0 w-full max-w-[var(--app-content-max-w)] flex-1 overflow-auto px-4 py-5 pb-safe sm:px-6 sm:py-6 md:px-8 md:py-8 lg:px-10",
        className,
      )}
    >
      {children}
    </div>
  );
}
