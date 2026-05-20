import { PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function ChatsLoading() {
  return (
    <div className="p-1">
      <PageHeaderSkeleton showActions={false} />
      <div className="mt-4 h-[calc(100dvh-10rem)] min-h-[400px] animate-pulse rounded-xl bg-[color:var(--color-skeleton)]" />
    </div>
  );
}
