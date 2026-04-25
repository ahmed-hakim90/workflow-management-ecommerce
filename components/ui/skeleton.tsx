import { cn } from "@/lib/ui/cn";

export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[color:var(--color-skeleton)]",
        className,
      )}
    />
  );
}
