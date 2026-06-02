import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Skeleton className="h-4 w-32" />

      <div className="mt-6 grid gap-8 lg:grid-cols-[340px_1fr]">
        <aside>
          <div className="overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm">
            <Skeleton className="aspect-[4/5] w-full rounded-none" />
            <div className="p-5">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/3" />
              <Skeleton className="mt-6 h-11 w-full rounded-full" />
              <Skeleton className="mt-2 h-10 w-full rounded-full" />
            </div>
          </div>
        </aside>

        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-5/6" />
          <Skeleton className="mt-2 h-4 w-4/6" />

          <Skeleton className="mt-8 h-6 w-32" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>

          <Skeleton className="mt-8 h-6 w-48" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
