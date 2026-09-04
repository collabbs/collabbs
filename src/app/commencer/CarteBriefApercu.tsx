"use client";

import { OFFER_BY_ID } from "@/components/landing/creators";
import type { CarteMarque } from "@/lib/quiz";

/**
 * La carte d'une marque, telle qu'un créateur la verra dans le défilé.
 *
 * Ce n'est PAS une fiche d'entreprise. Un créateur ne fait pas défiler des
 * logos, il fait défiler des propositions : il veut savoir ce qu'on lui
 * demande, combien on le paie et pour quand. Le nom de la marque n'est qu'un
 * élément de contexte, il n'est pas le sujet de la carte.
 *
 * D'où la hiérarchie : la rémunération est l'élément le plus gros de la carte,
 * avant même l'intitulé de la mission.
 */
export default function CarteBriefApercu({ carte }: { carte: CarteMarque }) {
  const formats = carte.formats.map((id) => OFFER_BY_ID[id]).filter(Boolean);

  const remuneration = (() => {
    const fixe = carte.montant !== null ? `${carte.montant.toLocaleString("fr-FR")} €` : null;
    const commission = carte.commission !== null ? `${carte.commission} %` : null;
    if (carte.remuneration === "les-deux" && (fixe || commission)) {
      return { principal: fixe ?? commission!, secondaire: fixe && commission ? `+ ${commission} sur les ventes` : null };
    }
    if (carte.remuneration === "commission" && commission) {
      return { principal: commission, secondaire: "de commission" };
    }
    if (fixe) return { principal: fixe, secondaire: "par créateur" };
    return null;
  })();

  const echeanceLisible = carte.echeance
    ? new Date(carte.echeance).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
    : null;

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-zinc-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,.04),0_24px_48px_-28px_rgba(0,0,0,.35)]">
      {/* Bandeau sombre : la marque, en contexte. Pas de logo demandé dans le
          questionnaire — même raison que la photo côté créateur, c'est le
          téléversement qui fait abandonner. */}
      <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-purple-950 to-zinc-900">
        <p className="px-4 text-center font-display text-lg font-black leading-tight tracking-tight text-white">
          {carte.nom || <span className="text-white/30">Ta marque</span>}
        </p>
      </div>

      <div className="px-1 pb-1 pt-3">
        <p className="text-sm font-bold leading-snug text-ink">
          {carte.produit || <span className="text-zinc-300">Ce que tu vends</span>}
        </p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {formats.length > 0 ? (
            formats.map((f) => (
              <span
                key={f.id}
                className="rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700"
              >
                {f.emoji} {f.short}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-dashed border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
              le format cherché
            </span>
          )}
        </div>

        {/* La rémunération est l'élément le plus gros de la carte : c'est elle
            qui décide si un créateur s'arrête ou fait défiler. */}
        <div className="mt-3">
          {remuneration ? (
            <p className="font-display text-2xl font-black tabular-nums leading-none tracking-tight text-ink">
              {remuneration.principal}
              {remuneration.secondaire && (
                <span className="ml-1.5 align-middle text-xs font-medium text-zinc-500">
                  {remuneration.secondaire}
                </span>
              )}
            </p>
          ) : (
            <p className="font-display text-2xl font-black leading-none tracking-tight text-zinc-300">
              — €
            </p>
          )}
        </div>

        <p className="mt-2 text-[11px] font-medium text-zinc-400">
          {echeanceLisible ? `À livrer avant le ${echeanceLisible}` : "Échéance à définir"}
        </p>
      </div>
    </div>
  );
}
