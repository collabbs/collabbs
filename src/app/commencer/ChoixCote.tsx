"use client";

import type { Cote } from "@/lib/quiz";

/**
 * La toute première question — celle qui manquait.
 *
 * Elle ne demande pas « tu es qui ? » mais « tu viens faire quoi ? ». La
 * différence n'est pas cosmétique : une agence, un indépendant, une marque en
 * lancement ne se reconnaissent pas dans le mot « marque », alors qu'ils se
 * reconnaissent tous dans « je cherche des créateurs ».
 *
 * Deux cartes, et rien d'autre à l'écran. C'est la leçon la plus nette du
 * tunnel Noom : pendant qu'on répond, on ne montre que ce sur quoi on répond.
 */
export default function ChoixCote({ onChoix }: { onChoix: (c: Cote) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col justify-center px-5 py-10 sm:py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
        Bienvenue
      </p>

      {/* Le titre affirme, il n'interroge pas. Chez Noom, l'écran qui demande
          le sexe s'intitule « Hormones impact how our bodies metabolize food » :
          on justifie la question avant de la poser, et on ne se sent pas
          interrogé mais expliqué. */}
      <h1 className="font-display mt-3 text-[26px] font-black leading-[1.12] tracking-tight text-ink sm:text-4xl">
        Les marques et les créateurs ne cherchent pas la même chose.
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-zinc-500 sm:text-base">
        Dis-nous de quel côté tu es, et on ne te montre que ce qui te concerne.
      </p>

      <div className="mt-8 grid gap-3">
        <button
          type="button"
          onClick={() => onChoix("creator")}
          className="group flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:border-ink hover:shadow-[0_12px_32px_-20px_rgba(0,0,0,.5)] focus-visible:border-ink"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-xl">
            🎬
          </span>
          <span className="min-w-0">
            <span className="block text-base font-bold text-ink sm:text-lg">
              Je crée du contenu
            </span>
            <span className="mt-0.5 block text-sm leading-snug text-zinc-500">
              Je veux que les marques me trouvent et me paient correctement.
            </span>
          </span>
          <span className="ml-auto shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-ink">
            →
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChoix("brand")}
          className="group flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:border-ink hover:shadow-[0_12px_32px_-20px_rgba(0,0,0,.5)] focus-visible:border-ink"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-800 to-purple-900 text-xl">
            🎯
          </span>
          <span className="min-w-0">
            <span className="block text-base font-bold text-ink sm:text-lg">
              Je cherche des créateurs
            </span>
            <span className="mt-0.5 block text-sm leading-snug text-zinc-500">
              Pour une marque, un produit, une boutique — peu importe la taille.
            </span>
          </span>
          <span className="ml-auto shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-ink">
            →
          </span>
        </button>
      </div>
    </div>
  );
}
