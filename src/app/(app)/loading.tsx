export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-zinc-200" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-zinc-100" />

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-100 bg-white p-4">
            <div className="h-7 w-16 rounded bg-zinc-200" />
            <div className="mt-2 h-3 w-20 rounded bg-zinc-100" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-100 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-zinc-200" />
              <div className="flex-1">
                <div className="h-3 w-20 rounded bg-zinc-100" />
                <div className="mt-2 h-4 w-32 rounded bg-zinc-200" />
              </div>
            </div>
            <div className="mt-4 h-3 w-full rounded bg-zinc-100" />
            <div className="mt-2 h-3 w-2/3 rounded bg-zinc-100" />
            <div className="mt-5 h-9 w-full rounded-full bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
