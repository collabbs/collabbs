import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <>
      <Skeleton className="h-10 w-72 max-w-full" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-100 bg-white p-5">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="mt-3 h-8 w-24" />
            <Skeleton className="mt-1 h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 lg:col-span-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-3 w-32" />
          <Skeleton className="mt-4 h-56 w-full rounded-xl" />
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-2 h-3 w-40" />
          <div className="mt-4 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-3 w-40" />
                <Skeleton className="mt-1.5 h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
