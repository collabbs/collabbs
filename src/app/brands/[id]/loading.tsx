import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Skeleton className="h-4 w-24" />

      <div className="mt-6 grid gap-8 lg:grid-cols-[340px_1fr]">
        <aside>
          <div className="overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm">
            <div className="flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 p-8">
              <Skeleton className="h-28 w-28 rounded-2xl" />
            </div>
            <div className="p-5">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/3" />
              <Skeleton className="mt-3 h-4 w-2/5" />
              <Skeleton className="mt-5 h-11 w-full rounded-full" />
            </div>
          </div>
        </aside>

        <div className="space-y-8">
          <div>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-5/6" />
            <Skeleton className="mt-2 h-4 w-3/6" />
          </div>

          <div>
            <Skeleton className="h-6 w-56" />
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-20 rounded-full" />
              ))}
            </div>
          </div>

          <div>
            <Skeleton className="h-6 w-40" />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
