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

export function SkeletonText({ className }: { className?: string }) {
  return <Skeleton className={cn("h-4 w-full", className)} />;
}

export function SkeletonCircle({ className }: { className?: string }) {
  return <Skeleton className={cn("size-9 shrink-0 rounded-full", className)} />;
}

export function PageHeaderSkeleton({
  showActions = true,
}: {
  showActions?: boolean;
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 max-w-full md:h-9" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      {showActions ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      ) : null}
    </header>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[color:var(--color-divider)] bg-[color:var(--color-card)] p-4 shadow-[var(--shadow-neo-raised)]",
        className,
      )}
    >
      <Skeleton className="mb-3 h-5 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-[85%]" />
    </div>
  );
}

export function TableSkeleton({
  rows = 8,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="overflow-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th
                key={i}
                className="sticky top-0 z-10 border-b border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-2.5 text-start"
              >
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-b border-[color:var(--color-border)]">
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-3 py-3">
                  <Skeleton
                    className={cn(
                      "h-4",
                      c === 0 ? "w-28" : c === cols - 1 ? "w-12" : "w-full max-w-[10rem]",
                    )}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[color:var(--color-divider)] bg-[color:var(--color-card)] p-4 shadow-[var(--shadow-neo-raised-sm)]">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-8 w-32" />
      <Skeleton className="mt-2 h-3 w-40" />
      <Skeleton className="mt-3 h-9 w-full rounded-lg" />
    </div>
  );
}

export function KanbanSkeleton({
  columns = 3,
  cardsPerColumn = 3,
}: {
  columns?: number;
  cardsPerColumn?: number;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none">
      {Array.from({ length: columns }).map((_, ci) => (
        <div
          key={ci}
          className="flex min-h-[280px] flex-col gap-3 rounded-2xl border border-[color:var(--color-divider)] bg-[color:var(--color-muted-bg)]/30 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="size-6 rounded-full" />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            {Array.from({ length: cardsPerColumn }).map((_, ki) => (
              <div
                key={ki}
                className="rounded-xl border border-[color:var(--color-divider)] bg-[color:var(--color-card)] p-3 shadow-[var(--shadow-neo-raised-sm)]"
              >
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-4 w-full" />
                <div className="mt-2 flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <PageHeaderSkeleton />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton className="md:col-span-2 lg:col-span-1" />
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-2xl border border-[color:var(--color-divider)] bg-[color:var(--color-card)] p-5 shadow-[var(--shadow-neo-raised)]">
            <Skeleton className="h-6 w-48" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-2xl border border-[color:var(--color-divider)] bg-[color:var(--color-card)] p-4 shadow-[var(--shadow-neo-raised)]">
            <Skeleton className="h-5 w-32" />
            <div className="mt-3 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsLayoutSkeleton() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8" aria-busy aria-live="polite">
      <aside className="hidden w-52 shrink-0 lg:block">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1 space-y-4">
        <PageHeaderSkeleton showActions={false} />
        <div className="rounded-2xl border border-[color:var(--color-divider)] bg-[color:var(--color-card)] p-5 shadow-[var(--shadow-neo-raised)]">
          <Skeleton className="h-5 w-36" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl sm:col-span-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShipmentsPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <PageHeaderSkeleton showActions={false} />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Skeleton className="mb-3 h-5 w-40" />
          <TableSkeleton rows={6} cols={3} />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-7">
          <CardSkeleton />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function WarehousePageSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <CardSkeleton />
        </div>
        <div className="lg:col-span-8">
          <TableSkeleton rows={8} cols={5} />
        </div>
      </div>
    </div>
  );
}

export function AnalyticsPageSkeleton() {
  return (
    <div className="space-y-6 pb-20" aria-busy aria-live="polite">
      <PageHeaderSkeleton />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Skeleton className="h-72 rounded-2xl lg:col-span-8" />
        <div className="flex flex-col gap-4 lg:col-span-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function AdminPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <PageHeaderSkeleton showActions={false} />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-6">
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
        <div className="col-span-12 lg:col-span-6">
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
        <div className="col-span-12">
          <Skeleton className="mb-3 h-5 w-24" />
          <TableSkeleton rows={6} cols={5} />
        </div>
      </div>
    </div>
  );
}

export function UsersPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}

/** Mobile order list placeholder (matches ResponsiveCard density). */
export function OrderCardListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[color:var(--color-divider)] bg-[color:var(--color-card)] p-4 shadow-[var(--shadow-neo-raised-sm)]"
        >
          <Skeleton className="h-4 w-28" />
          <div className="mt-3 flex items-center gap-2">
            <SkeletonCircle />
            <Skeleton className="h-4 flex-1" />
          </div>
          <Skeleton className="mt-3 h-6 w-32" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-9 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}
