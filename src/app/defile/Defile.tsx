"use client";

import { useState } from "react";
import Link from "next/link";
import { useStockageLocal } from "@/hooks/useStockageLocal";
import { CLE_INTERETS } from "@/lib/quiz";
import type { BriefDefile } from "@/lib/defile";
import CarteBrief, { type Direction } from "./CarteBrief";

/**
 * Le défilé, côté créateur.
 *
 * ─── Où se pose le mur ───
 * Faire défiler ne demande rien. Mais marquer son intérêt, c'est envoyer un
 * signal à quelqu'un — et ça exige une identité. Le mur se pose donc
 * exactement là, et pas avant : on ne demande jamais de compte à quelqu'un qui
 * n'a encore rien voulu.
 *
 * Les intérêts sont gardés dans le navigateur en attendant. L'écran
 * d'inscription ne dira pas « crée un compte » mais « tes 3 coups de cœur
 * t'attendent » : ce n'est plus un formulaire, c'est la récupération de
 * quelque chose qu'on possède déjà.
 *
 * ─── Ce qui n'est pas là, volontairement ───
 * Pas de compteur « 4 sur 12 ». On ne montre jamais le fond du paquet : c'est
 * ce qui fait qu'un catalogue de 25 profils paraît vide alors que les mêmes 25
 * font défiler longtemps.
 */

export default function Defile({ briefs }: { briefs: BriefDefile[] }) {
  const [interets, setInterets] = useStockageLocal<string[]>(CLE_INTERETS, []);
  const [index, setIndex] = useState(0);

  const brief = briefs[index];
  const fini = index >= briefs.length;

  function passer() {
    setIndex((i) => i + 1);
  }

  function interesse() {
    if (brief && !interets.includes(brief.id)) {
      setInterets([...interets, brief.id]);
    }
    setIndex((i) => i + 1);
  }

  /* ────────────────────────────────────── fin du paquet, ou le mur ──────── */
  if (fini) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center px-5 py-12 text-center">
        {interets.length > 0 ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
              {interets.length === 1 ? "1 coup de cœur" : `${interets.length} coups de cœur`}
            </p>
            <h1 className="font-display mt-3 text-[26px] font-black leading-[1.12] tracking-tight text-ink sm:text-4xl">
              {interets.length === 1
                ? "Cette marque ne sait pas encore que tu es intéressé."
                : "Ces marques ne savent pas encore que tu es intéressé."}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-500">
              Crée ton profil pour qu&apos;elles le voient. C&apos;est gratuit, et
              tu gardes 100 % de ce qui est convenu.
            </p>
            <Link
              href="/signup?role=creator"
              className="mt-7 flex min-h-[58px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 text-base font-bold text-white transition hover:opacity-90"
            >
              Me faire connaître
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-[26px] font-black leading-[1.12] tracking-tight text-ink sm:text-4xl">
              Tu as tout vu pour le moment.
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-500">
              De nouveaux briefs arrivent régulièrement. Crée ton profil et les
              marques viendront à toi sans que tu aies à chercher.
            </p>
            <Link
              href="/commencer"
              className="mt-7 flex min-h-[58px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 text-base font-bold text-white transition hover:opacity-90"
            >
              Créer ma carte
            </Link>
          </>
        )}
        <Link
          href="/decouvrir"
          className="mt-5 text-sm font-medium text-zinc-400 underline underline-offset-2 transition hover:text-ink"
        >
          Comprendre comment ça marche
        </Link>
      </div>
    );
  }

  /* ─────────────────────────────────────────── la pile qu'on fait glisser ── */
  function decider(d: Direction) {
    if (d === "droite") interesse();
    else passer();
  }

  const suivant = briefs[index + 1];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-5 py-6 sm:py-10">
      {/* La carte du dessous donne l'épaisseur du paquet : sans elle, chaque
          carte jetée laisse un trou blanc et on croit être arrivé au bout. */}
      <div className="relative">
        {suivant && <CarteBrief key={suivant.id} brief={suivant} enArriere />}
        <CarteBrief key={brief.id} brief={brief} onDecision={decider} />
      </div>

      <p className="mt-5 text-center text-xs font-medium text-zinc-400">
        Fais glisser la carte — à droite si ça t&apos;intéresse, à gauche sinon.
      </p>

      {/* Les boutons restent : tout le monde ne glisse pas, et un geste ne se
          fait ni au clavier ni au lecteur d'écran. */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={passer}
          className="min-h-[58px] rounded-2xl border border-zinc-200 bg-white text-base font-bold text-zinc-500 transition hover:border-zinc-400 hover:text-ink"
        >
          Passer
        </button>
        <button
          type="button"
          onClick={interesse}
          className="min-h-[58px] rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-base font-bold text-white transition hover:opacity-90"
        >
          Ça m&apos;intéresse
        </button>
      </div>

      <Link
        href="/decouvrir"
        className="mt-6 self-center text-sm font-medium text-zinc-400 underline underline-offset-2 transition hover:text-ink"
      >
        Je découvre Collabbs d&apos;abord
      </Link>
    </div>
  );
}
