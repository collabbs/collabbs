"use client";

import Link from "next/link";
import { photoDuBrief, remunerationLisible } from "./CarteBrief";
import type { BriefDefile } from "@/lib/defile";
import { assombrir, eclaircir } from "@/lib/teinte";

/**
 * L'interruption au 5ᵉ intérêt — le moment où l'on demande le compte.
 *
 * ─── Pourquoi là, et pas à la fin ───
 * Le compte n'était proposé qu'après un match, ou une fois le paquet vide.
 * Quelqu'un qui retenait six campagnes puis refermait n'était jamais sollicité,
 * alors qu'il venait de faire exactement ce qu'on espérait. On demandait au
 * moment de la lassitude, pas au moment de l'envie.
 *
 * ─── Quatre cadrages essayés ───
 * 1. Un gros « 5 » sur un dégradé. On ne perd pas un nombre.
 * 2. « Ce que tu as retenu : 1 180 € ». Ces campagnes n'ont rien accordé à
 *    personne — afficher un total comme un acquis, c'est le mensonge du match
 *    simulé en plus discret.
 * 3. « Tu n'as pas de profil ». Il VIENT de créer sa carte au questionnaire.
 * 4. « Ta carte n'existe que dans ce navigateur, publie-la. » Vrai, mais
 *    construit sur la PERTE : ce qu'on risque de laisser filer.
 *
 * ─── Ce qu'on dit maintenant ───
 * L'inverse : l'abondance. « Tu en as retenu cinq — il y en a trente-cinq
 * autres, et d'autres arrivent. » On n'agite pas ce qu'il pourrait perdre, on
 * montre ce qui l'attend. Le compte n'est plus une précaution, c'est la porte.
 *
 * Le nombre restant est CALCULÉ, pas décoratif : c'est la taille réelle du
 * paquet moins ce qu'il a déjà vu. Une abondance annoncée au hasard se
 * démentirait au troisième écran.
 *
 * ─── Sur la direction artistique ───
 * Cet écran était un plein écran NOIR avec un dégradé violet/rose. Ça ne
 * venait de nulle part : la DA Collabbs est claire et tiède — fond #FCFAFB
 * jamais blanc pur, halos violet et cyan très flous, surfaces douces #F4F1F5,
 * bouton noir. Un écran inventé au milieu d'un parcours cohérent se remarque
 * comme une pièce rapportée, et il fait douter du reste.
 */
export default function EcranRelance({
  retenus,
  nombre,
  cote,
  restants,
  onContinuer,
}: {
  /** Ce qui a été retenu, dans l'ordre. Vide côté marque. */
  retenus: BriefDefile[];
  nombre: number;
  /** Ce qui reste à découvrir dans le paquet. Vrai, pas décoratif. */
  restants: number;
  cote: "createur" | "marque";
  onContinuer: () => void;
}) {
  const estCreateur = cote === "createur";
  const enEventail = retenus.slice(-3).reverse();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#FCFAFB] px-6 text-center">
      {/* Les halos du Hero, à l'identique : c'est la signature de fond du site. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-32 h-[560px] w-[560px] rounded-full bg-gradient-to-br from-purple-300/40 to-pink-300/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-40 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-cyan-200/30 to-purple-200/20 blur-3xl"
      />

      <div className="relative flex w-full max-w-sm flex-col items-center">
        {/* Ce qu'il a retenu, en éventail : les seules choses de cet écran qui
            soient déjà réelles. Elles apportent la couleur, on n'en rajoute pas. */}
        {enEventail.length > 0 && (
          <div className="relative mb-8 h-[184px] w-[146px]">
            {enEventail.map((b, i) => {
              const photo = photoDuBrief(b);
              const base = b.couleurMarque ?? "#1b1b21";
              const r = remunerationLisible(b);
              return (
                <div
                  key={b.id}
                  className="absolute inset-0 overflow-hidden rounded-2xl shadow-[0_16px_40px_-16px_rgba(24,16,40,.45)] ring-1 ring-black/5"
                  style={{
                    transform: `rotate(${(i - 1) * 10}deg) translateY(${Math.abs(i - 1) * 5}px)`,
                    zIndex: 3 - i,
                    backgroundColor: assombrir(base, 0.3),
                    backgroundImage: photo
                      ? `url("${photo}")`
                      : `radial-gradient(90% 65% at 30% 15%, ${eclaircir(base, 0.4)} 0%, ${assombrir(base, 0.5)} 75%)`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />
                  <p className="font-display absolute bottom-2 left-2.5 right-2 truncate text-left text-[15px] font-black text-white">
                    {r?.gros ?? b.marque}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          {nombre} {estCreateur ? "campagnes retenues" : "créateurs repérés"}
        </p>

        <h2 className="font-display mt-3 text-[32px] font-black leading-[1.08] tracking-tight text-ink">
          {restants > 0 ? (
            <>
              Et{" "}
              <span className="bg-[linear-gradient(135deg,#5b21b6_0%,#7c3aed_50%,#06b6d4_100%)] bg-clip-text text-transparent">
                {restants} autres
              </span>
              <br />
              t&apos;attendent.
            </>
          ) : (
            <>
              <span className="bg-[linear-gradient(135deg,#5b21b6_0%,#7c3aed_50%,#06b6d4_100%)] bg-clip-text text-transparent">
                D&apos;autres arrivent
              </span>
              <br />
              chaque semaine.
            </>
          )}
        </h2>

        <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-zinc-500">
          {estCreateur
            ? "Crée ton compte pour monétiser tes vidéos avec des collaborations — et garde celles que tu as retenues."
            : "Crée ton compte pour lancer ta campagne avec ces créateurs — et garde ta sélection."}
        </p>

        <Link
          href={estCreateur ? "/signup?role=creator" : "/signup?role=brand"}
          className="mt-7 flex min-h-[58px] w-full items-center justify-center rounded-xl bg-ink px-6 text-[16px] font-semibold text-white transition hover:opacity-90"
        >
          {estCreateur ? "Créer mon compte" : "Créer mon compte"}
        </Link>

        {/* On ne bloque pas : interrompre deux fois ferait partir pour de bon. */}
        <button
          type="button"
          onClick={onContinuer}
          className="mt-4 text-[14px] font-medium text-zinc-400 transition hover:text-ink"
        >
          Continuer à regarder
        </button>
      </div>
    </div>
  );
}
