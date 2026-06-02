/**
 * Skeleton — bloc gris animé pour placeholder de chargement.
 * L'animation shimmer est définie dans globals.css (.skeleton-shimmer).
 *
 * Usage :
 *   <Skeleton className="h-4 w-32" />
 *   <Skeleton className="h-40 w-full rounded-2xl" />
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`skeleton-shimmer rounded-md bg-zinc-100 ${className}`}
      aria-hidden="true"
    />
  );
}

/** Carte créateur placeholder (utilisé pour /creators, /opportunities). */
export function CreatorCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="p-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-1.5 h-3 w-16" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** Carte opportunity / campagne placeholder. */
export function CampaignCardSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
      </div>
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-3/4" />
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-9 w-full rounded-full" />
    </div>
  );
}

/** Ligne de liste générique (deal, conversation, transaction). */
export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white p-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-3 w-1/3" />
      </div>
      <Skeleton className="h-7 w-16 rounded-full" />
    </div>
  );
}
