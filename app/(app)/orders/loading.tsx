import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <PageHeaderSkeleton />
      <TableSkeleton rows={10} cols={6} />
    </div>
  );
}
