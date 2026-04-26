import { KanbanSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function TicketsLoading() {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <PageHeaderSkeleton />
      <KanbanSkeleton columns={3} cardsPerColumn={3} />
    </div>
  );
}
