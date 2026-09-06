"use client";

import Link from "next/link";
import type { MarketplaceCreator } from "@/lib/creators-data";

/**
 * Le match, côté marque.
 *
 * Jumeau de `EcranMatch` mais dans l'autre sens : ici c'est un créateur qui
 * s'était déjà déclaré intéressé par un brief de cette marque.
 *
 * ⚠️ Aucun match spontané n'est possible aujourd'hui de ce côté : un créateur
 * ne peut pas marquer son intérêt sans compte. Cet écran ne s'affiche donc que
 * sur `?apercu=match`, et il le dit. Annoncer un match à une marque qui
 * n'obtiendra jamais de réponse est le plus sûr moyen de ne plus jamais la
 * revoir.
 */
export default function EcranMatchCreateur({
  createur,
  onContinuer,
  apercu,
}: {
  createur: MarketplaceCreator;
  onContinuer: () => void;
  apercu?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-purple-700 via-fuchsia-700 to-pink-600 px-6 py-10 text-center">
      {apercu && (
        <span className="mb-6 rounded-full bg-black/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/80">
          Aperçu — aucun match réel
        </span>
      )}

      <p className="font-display text-[42px] font-black leading-none tracking-tight text-white sm:text-6xl">
        C&apos;est un match&nbsp;!
      </p>
      <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/85 sm:text-lg">
        <strong className="font-bold text-white">{createur.name}</strong>{" "}
        s&apos;était déjà déclaré intéressé par ta campagne.
      </p>

      <div className="mt-8 w-full max-w-xs overflow-hidden rounded-3xl bg-white/10 backdrop-blur-sm">
        <div
          className="aspect-[4/3] w-full bg-cover bg-center"
          style={{ backgroundImage: `url("${createur.photo}"), ${createur.tint}` }}
        />
        <div className="p-5 text-left">
          <p className="font-display text-2xl font-black leading-tight tracking-tight text-white">
            {createur.name}
          </p>
          <p className="text-[13px] text-white/60">
            @{createur.handle} · {createur.followers}
          </p>
          {createur.priceFrom !== null && (
            <p className="mt-3 font-display text-2xl font-black tabular-nums text-white">
              dès {createur.priceFrom.toLocaleString("fr-FR")} €
            </p>
          )}
        </div>
      </div>

      <Link
        href="/signup?role=brand"
        className="mt-8 flex min-h-[58px] w-full max-w-xs items-center justify-center rounded-2xl bg-white px-6 text-base font-bold text-purple-700 transition hover:bg-white/90"
      >
        Lui envoyer mon brief
      </Link>

      <button
        type="button"
        onClick={onContinuer}
        className="mt-4 text-sm font-semibold text-white/70 underline underline-offset-4 transition hover:text-white"
      >
        Continuer à regarder
      </button>
    </div>
  );
}
