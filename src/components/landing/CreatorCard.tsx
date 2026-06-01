import Link from "next/link";
import { type Creator, OFFER_BY_ID } from "./creators";

export default function CreatorCard({
  creator,
  href,
  overlay,
}: {
  creator: Creator;
  /** Si fourni, toute la carte devient cliquable (ex. vers /signup pour collaborer). */
  href?: string;
  /** Bouton/élément optionnel placé en absolu (ex. cœur shortlist). */
  overlay?: React.ReactNode;
}) {
  const card = (
    <div className="group h-full overflow-hidden rounded-2xl border border-zinc-100 bg-white p-2.5 shadow-sm transition duration-300 hover:shadow-xl">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url("${creator.photo}"), ${creator.tint}` }}
        />
        {overlay}
        <span className="absolute left-2 top-12 z-10 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 shadow-sm">
          {creator.platform}
        </span>
        <span className="absolute right-2 top-2 z-10 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
          ★ {creator.rating.toFixed(1)}
        </span>
      </div>

      <div className="px-1 pb-1 pt-3">
        <p className="text-sm font-semibold text-ink">{creator.name}</p>
        <p className="text-xs text-zinc-500">@{creator.handle}</p>
        <p className="mt-1.5 text-[11px] text-zinc-400">
          <span className="font-medium text-purple-700">{creator.niche}</span> ·{" "}
          {creator.followers} · {creator.engagement} eng.
        </p>

        {/* Façons de collaborer */}
        <div className="mt-2.5 flex flex-wrap gap-1">
          {creator.offers.map((id) => {
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

        <p className="mt-2.5 text-xs text-zinc-500">
          {creator.priceFrom !== null ? (
            <>
              à partir de{" "}
              <span className="text-sm font-bold text-ink">{creator.priceFrom}€</span>
            </>
          ) : (
            <span className="font-semibold text-ink">À la performance</span>
          )}
        </p>
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
