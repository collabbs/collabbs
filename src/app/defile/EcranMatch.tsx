"use client";

import Link from "next/link";
import type { BriefDefile } from "@/lib/defile";
import { remunerationLisible } from "./CarteBrief";

/**
 * Le match.
 *
 * C'est le seul écran du produit qui produise de la FIERTÉ. Un simulateur de
 * tarif rend un chiffre ; un match rend une reconnaissance — la preuve qu'une
 * marque veut travailler avec toi. C'est pour ça qu'il doit être beau : c'est
 * lui qu'un créateur capture en photo et publie, et c'est la seule partie du
 * produit où le soin graphique agit directement sur l'acquisition.
 *
 * ⚠️ Un match ne se déclenche que si la marque a REELLEMENT marqué son intérêt
 * (`dejaInteressee`). On ne fabrique pas de fausse réciprocité : une marque
 * qui n'a rien demandé et à qui on annonce un match ne répondra pas, et le
 * créateur ne reviendra plus. Voir `apercuMatchDemande` dans la page pour le
 * mode d'aperçu, qui sert à juger l'écran et n'apparaît jamais tout seul.
 */
export default function EcranMatch({
  brief,
  onContinuer,
  apercu,
}: {
  brief: BriefDefile;
  onContinuer: () => void;
  /** Aperçu demandé à la main : on le dit, plutôt que de laisser croire. */
  apercu?: boolean;
}) {
  const remuneration = remunerationLisible(brief);

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
        <strong className="font-bold text-white">{brief.marque}</strong>{" "}
        cherchait quelqu&apos;un comme toi, et tu viens de dire que ça
        t&apos;intéresse.
      </p>

      {/* Le brief en petit : on rappelle sur quoi porte le match, sinon la
          personne se réjouit sans savoir de quoi. */}
      <div className="mt-8 w-full max-w-xs rounded-3xl bg-white/10 p-5 backdrop-blur-sm">
        <p className="font-display text-2xl font-black leading-tight tracking-tight text-white">
          {brief.marque}
        </p>
        {brief.produit && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-white/70">
            {brief.produit}
          </p>
        )}
        {remuneration && (
          <p className="mt-4 font-display text-3xl font-black leading-none tabular-nums text-white">
            {remuneration.gros}
            <span className="ml-2 align-middle text-[11px] font-medium text-white/60">
              {remuneration.petit}
            </span>
          </p>
        )}
      </div>

      <Link
        href="/signup?role=creator"
        className="mt-8 flex min-h-[58px] w-full max-w-xs items-center justify-center rounded-2xl bg-white px-6 text-base font-bold text-purple-700 transition hover:bg-white/90"
      >
        Lui répondre
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
