import { KanbanSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function KanbanLoading() {
  return (
    <div className="space-y-6" aria-busy aria-live="polite">
      <PageHeaderSkeleton />
      <KanbanSkeleton columns={5} cardsPerColumn={3} />
    </div>
  );
}
