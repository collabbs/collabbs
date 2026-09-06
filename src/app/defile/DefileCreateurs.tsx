"use client";

import { useState } from "react";
import Link from "next/link";
import { useStockageLocal } from "@/hooks/useStockageLocal";
import { CLE_REPERAGES, listeDeTextes } from "@/lib/quiz";
import type { MarketplaceCreator } from "@/lib/creators-data";
import CarteCreateur from "./CarteCreateur";
import type { Direction } from "./CarteBrief";

/**
 * Le défilé, côté marque : on fait défiler des créateurs.
 *
 * ─── Ce que ça remplace ───
 * Le questionnaire marque renvoyait vers `/creators`, l'annuaire avec ses
 * filtres. Or une marque ne cherche pas dans un annuaire, elle reconnaît
 * quelqu'un — et filtrer suppose de savoir ce qu'on veut, ce qui est
 * exactement ce qu'on ne sait pas encore.
 *
 * ─── Pourquoi aucun match de ce côté ───
 * Un créateur peut matcher parce qu'une marque a publié un brief qui l'attend.
 * L'inverse n'existe pas encore : un créateur ne marque pas son intérêt pour
 * une marque tant qu'il n'a pas de compte. Marquer un créateur ici, c'est donc
 * du REPÉRAGE, et on ne promet rien de plus.
 */
export default function DefileCreateurs({ createurs }: { createurs: MarketplaceCreator[] }) {
  const [reperagesBrut, setReperages] = useStockageLocal<string[]>(CLE_REPERAGES, []);
  // Une valeur qui n'est pas un tableau ferait lever `.includes` et tomber la
  // page. On répare, on ne fait pas confiance.
  const reperages = listeDeTextes(reperagesBrut);
  const [index, setIndex] = useState(0);

  const createur = createurs[index];
  const suivant = createurs[index + 1];
  const fini = index >= createurs.length;

  function avancer() {
    setIndex((i) => i + 1);
  }

  function reperer() {
    if (!createur) return;
    if (!reperages.includes(createur.id)) setReperages([...reperages, createur.id]);
    avancer();
  }

  function decider(d: Direction) {
    if (d === "droite") reperer();
    else avancer();
  }

  if (fini) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-6 py-12 text-center">
        {reperages.length > 0 ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
              {reperages.length === 1 ? "1 créateur repéré" : `${reperages.length} créateurs repérés`}
            </p>
            <h1 className="font-display mt-3 text-[28px] font-black leading-[1.12] tracking-tight text-ink sm:text-4xl">
              {reperages.length === 1
                ? "Ce créateur ne sait pas encore que tu l'as remarqué."
                : "Ces créateurs ne savent pas encore que tu les as remarqués."}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-500">
              Crée ton compte pour leur envoyer ton brief. Contrat généré tout
              seul, paiement bloqué jusqu&apos;à la livraison.
            </p>
            <Link
              href="/signup?role=brand"
              className="mt-7 flex min-h-[58px] w-full max-w-xs items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 text-base font-bold text-white transition hover:opacity-90"
            >
              Les contacter
            </Link>
          </>
        ) : (
          /* Personne n'a retenu son attention : on explique, on ne réclame pas.
             Un formulaire à quelqu'un qui n'a pas compris ne se remplit pas. */
          <>
            <h1 className="font-display text-[28px] font-black leading-[1.12] tracking-tight text-ink sm:text-4xl">
              Personne ne t&apos;a convaincu&nbsp;?
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-500">
              Tu ne sais peut-être pas encore ce que Collabbs peut faire pour toi.
              Deux minutes pour comprendre, et tu reviendras avec un autre œil.
            </p>
            <Link
              href="/decouvrir"
              className="mt-7 flex min-h-[58px] w-full max-w-xs items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 text-base font-bold text-white transition hover:opacity-90"
            >
              Découvrir Collabbs
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col px-4 pb-6">
      <div className="relative min-h-0 flex-1">
        {suivant && <CarteCreateur key={suivant.id} createur={suivant} enArriere />}
        <CarteCreateur key={createur.id} createur={createur} onDecision={decider} />
      </div>

      <div className="mt-5 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={avancer}
          aria-label="Passer"
          className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-200 bg-white text-2xl text-rose-500 shadow-[0_8px_20px_-10px_rgba(0,0,0,.4)] transition hover:scale-105 active:scale-95"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={reperer}
          aria-label="Ce créateur m'intéresse"
          className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-3xl text-white shadow-[0_12px_28px_-10px_rgba(168,85,247,.8)] transition hover:scale-105 active:scale-95"
        >
          ♥
        </button>
      </div>

      <p className="mt-4 text-center text-[11px] font-medium text-zinc-400">
        Fais glisser — à droite si le profil te plaît, à gauche sinon.
      </p>
    </div>
  );
}
