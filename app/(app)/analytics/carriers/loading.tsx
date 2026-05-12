import { Skeleton } from "@/components/ui/skeleton";

export default function CarrierLedgerLoading() {
  return (
    <div className="space-y-6 pb-20">
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-24 w-full rounded-[var(--ds-radius-md)]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[var(--ds-radius-md)]" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-72 w-full rounded-[var(--ds-radius-md)]" />
      ))}
    </div>
  );
}
