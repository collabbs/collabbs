import { Skeleton, CampaignCardSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <>
      <Skeleton className="h-10 w-56" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />

      <div className="mt-6 flex max-w-xl items-center gap-2">
        <Skeleton className="h-11 flex-1 rounded-lg" />
        <Skeleton className="h-11 w-24 rounded-lg" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>

      <Skeleton className="mt-6 h-4 w-24" />

      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CampaignCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}
