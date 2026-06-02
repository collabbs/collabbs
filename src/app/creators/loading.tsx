import { Skeleton, CreatorCardSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-8 sm:py-10 lg:px-12">
      <Skeleton className="h-10 w-72 max-w-full" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />

      <div className="mt-6 flex max-w-xl items-center gap-2">
        <Skeleton className="h-11 flex-1 rounded-lg" />
        <Skeleton className="h-11 w-24 rounded-lg" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>

      <Skeleton className="mt-6 h-4 w-32" />

      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <CreatorCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
