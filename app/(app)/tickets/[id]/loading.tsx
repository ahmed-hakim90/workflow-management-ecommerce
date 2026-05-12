import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function TicketDetailLoading() {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-[var(--ds-radius-md)]" />
        <Skeleton className="h-64 rounded-[var(--ds-radius-md)]" />
      </div>
    </div>
  );
}
