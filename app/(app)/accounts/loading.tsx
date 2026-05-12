import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function AccountsLoading() {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <PageHeaderSkeleton showActions={false} />
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-64 w-full rounded-[var(--ds-radius-lg)]"
          />
        ))}
      </div>
    </div>
  );
}
