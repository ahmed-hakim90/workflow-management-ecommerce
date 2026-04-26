import {
  PageHeaderSkeleton,
  Skeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <PageHeaderSkeleton />
      <div className="rounded-2xl border-0 bg-[color:var(--color-card)] p-4 shadow-[var(--shadow-neo-raised)]">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2 border-t border-[color:var(--color-divider)] pt-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-md" />
          ))}
        </div>
      </div>
      <TableSkeleton rows={10} cols={7} />
    </div>
  );
}
