import {
  CardSkeleton,
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

export default function InboxLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" aria-busy aria-live="polite">
      <PageHeaderSkeleton showActions={false} />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-8 w-20 rounded-[var(--ds-radius-md)]"
          />
        ))}
      </div>
      <div className="grid min-h-[480px] flex-1 gap-4 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <CardSkeleton className="min-h-[320px]" />
        <div className="flex min-h-0 flex-col gap-4 lg:flex-row">
          <CardSkeleton className="min-h-[320px] flex-1" />
          <Skeleton className="hidden min-h-[200px] w-full shrink-0 rounded-[var(--ds-radius-md)] lg:block lg:w-72" />
        </div>
      </div>
    </div>
  );
}
