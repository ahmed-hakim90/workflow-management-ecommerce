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
        "min-h-0 max-w-full flex-1 overflow-auto p-4 pb-safe md:p-5 lg:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
