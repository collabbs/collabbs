import { Skeleton, ListRowSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <>
      <Skeleton className="h-10 w-32" />
      <Skeleton className="mt-3 h-4 w-72" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <ListRowSkeleton key={i} />
        ))}
      </div>
    </>
  );
}
