"use client";

import PlatformIcon from "@/components/PlatformIcon";
import { OFFER_BY_ID } from "@/components/landing/creators";
import { libelleTranche, type CarteCreateur } from "@/lib/quiz";

/**
 * La carte du créateur, telle qu'une marque la verra dans le défilé.
 *
 * Elle s'affiche pendant qu'on répond, et se remplit à mesure. C'est tout
 * l'intérêt du questionnaire : on ne remplit pas un formulaire à l'aveugle, on
 * regarde un objet se construire. Chaque réponse a un effet visible immédiat,
 * ce qui est la seule raison pour laquelle quelqu'un répond à la cinquième.
 *
 * Les zones non encore renseignées ne sont pas cachées : elles apparaissent en
 * creux. Un trou qu'on voit donne envie de le combler ; un trou invisible
 * laisse croire qu'on a fini.
 */
export default function CarteApercu({ carte }: { carte: CarteCreateur }) {
  const palier = libelleTranche(carte.audience);
  const offres = carte.offres.map((id) => OFFER_BY_ID[id]).filter(Boolean);

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-zinc-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,.04),0_24px_48px_-28px_rgba(0,0,0,.35)]">
      {/* Visuel. Pas de photo demandée dans le questionnaire : téléverser une
          image avant d'avoir un compte, sur téléphone, c'est le moment où l'on
          abandonne. La photo se demandera à l'inscription, et c'est même
          l'argument qui la justifiera — « ajoute ta photo pour être visible ». */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500">
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_10%,rgba(255,255,255,.35),transparent_55%)]" />

        {carte.plateforme && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <PlatformIcon slug={carte.plateforme} className="h-3.5 w-3.5" />
            {palier ?? "—"}
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-black/55 to-transparent p-4 pt-10">
          <p className="text-center text-lg font-black leading-tight tracking-tight text-white">
            {carte.handle ? `@${carte.handle}` : "@ton pseudo"}
          </p>
        </div>
      </div>

      <div className="px-1 pb-1 pt-3">
        <div className="flex flex-wrap gap-1.5">
          {carte.niches.length > 0 ? (
            carte.niches.map((n) => (
              <span
                key={n}
                className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
              >
                {n}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-dashed border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
              ta niche
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {offres.length > 0 ? (
            offres.map((o) => (
              <span
                key={o.id}
                className="rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700"
              >
                {o.emoji} {o.short}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-dashed border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
              ce que tu proposes
            </span>
          )}
        </div>

        <p className="mt-3 font-display text-2xl font-black tabular-nums tracking-tight text-ink">
          {carte.prixMini !== null ? (
            <>
              dès {carte.prixMini.toLocaleString("fr-FR")} €
            </>
          ) : (
            <span className="text-zinc-300">dès — €</span>
          )}
        </p>
      </div>
    </div>
  );
}
