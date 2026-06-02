import Link from "next/link";
import PlatformIcon from "@/components/PlatformIcon";
import { type Creator, OFFER_BY_ID } from "./creators";

/** Mappe un nom de plateforme vers son slug (pour PlatformIcon). */
function platformSlug(label: string): string {
  const l = label.toLowerCase();
  if (l === "x") return "twitter";
  return l;
}

export default function CreatorCard({
  creator,
  href,
  overlay,
}: {
  creator: Creator & { platformSlug?: string };
  /** Si fourni, toute la carte devient cliquable (ex. vers /signup pour collaborer). */
  href?: string;
  /** Bouton/élément optionnel placé en absolu (ex. cœur shortlist). */
  overlay?: React.ReactNode;
}) {
  const slug = creator.platformSlug ?? platformSlug(creator.platform);
  const hasBadges = creator.isTop || creator.isVerified || creator.isNew;

  const card = (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-zinc-100 bg-white p-2.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-200 hover:shadow-xl">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
          style={{ backgroundImage: `url("${creator.photo}"), ${creator.tint}` }}
        />

        {/* Gradient bas pour lisibilité du badge plateforme + note */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" />

        {overlay}

        {/* Badges contextuels en haut à gauche */}
        {hasBadges && (
          <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
            {creator.isTop && (
              <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
                ★ Top
              </span>
            )}
            {creator.isVerified && (
              <span className="flex items-center gap-1 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2 9.6 4.3 6.5 4l-.6 3-2.7 1.7L4.7 12l-1.5 3 2.7 1.7.6 3 3.1-.3L12 22l2.4-2.6 3.1.3.6-3 2.7-1.7-1.5-3 1.5-3-2.7-1.7-.6-3-3.1.3L12 2Zm-1 13.5-3.5-3.5 1.4-1.4 2.1 2.1L15.7 8l1.4 1.4-6.1 6.1Z" />
                </svg>
                Vérifié
              </span>
            )}
            {creator.isNew && !creator.isTop && (
              <span className="rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
                ✨ Nouveau
              </span>
            )}
          </div>
        )}

        {/* Note en haut à droite */}
        <span className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
          <span className="text-amber-300">★</span>
          {creator.rating.toFixed(1)}
        </span>

        {/* Plateforme + abonnés en bas */}
        <div className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-between">
          <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 shadow-sm">
            <PlatformIcon slug={slug} className="h-3 w-3" />
            {creator.followers}
          </span>
        </div>

        {/* Hover overlay : CTA "Voir le profil" */}
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/0 p-3 opacity-0 transition-all duration-300 group-hover:bg-black/20 group-hover:opacity-100">
          <span className="translate-y-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-ink shadow-lg transition-transform duration-300 group-hover:translate-y-0">
            Voir le profil →
          </span>
        </div>
      </div>

      <div className="px-1 pb-1 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{creator.name}</p>
            <p className="truncate text-xs text-zinc-500">@{creator.handle}</p>
          </div>
        </div>

        <p className="mt-1.5 text-[11px] text-zinc-500">
          <span className="font-semibold text-brand-deep">{creator.niche}</span>{" "}
          <span className="text-zinc-400">·</span>{" "}
          <span className="font-medium text-zinc-600">{creator.engagement} eng.</span>
        </p>

        {/* Façons de collaborer */}
        <div className="mt-2.5 flex flex-wrap gap-1">
          {creator.offers.slice(0, 4).map((id) => {
            const offer = OFFER_BY_ID[id];
            const highlight = id === "affil";
            return (
              <span
                key={id}
                title={offer.label}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                  highlight
                    ? "bg-gradient-to-r from-purple-100 to-pink-100 font-semibold text-brand-deep"
                    : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {offer.emoji} {offer.short}
              </span>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5">
          <p className="text-xs text-zinc-500">
            {creator.priceFrom !== null ? (
              <>
                dès{" "}
                <span className="text-sm font-extrabold text-ink">
                  {creator.priceFrom}€
                </span>
              </>
            ) : (
              <span className="font-semibold text-ink">À la performance</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    );
  }
  return card;
}
