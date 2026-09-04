"use client";

import { useState } from "react";
import Link from "next/link";
import { useStockageLocal } from "@/hooks/useStockageLocal";
import { CLE_INTERETS } from "@/lib/quiz";
import type { BriefDefile } from "@/lib/defile";

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

const LIBELLES_TYPE: Record<string, string> = {
  video: "Vidéo postée",
  ugc: "Contenu UGC",
  affiliation: "Affiliation",
  performance: "Performance",
  hybrid: "Fixe + commission",
  cpa_tiers: "Paliers",
};

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

  /* ───────────────────────────────────────────────────────── une carte ──── */
  const remuneration = (() => {
    const c = brief.commission;
    const taux = c ? (c.min === c.max ? `${c.min} %` : `${c.min}–${c.max} %`) : null;
    if (brief.montant !== null && taux) {
      return {
        gros: `${brief.montant.toLocaleString("fr-FR")} €`,
        petit: `+ ${taux} sur les ventes`,
      };
    }
    if (brief.montant !== null) {
      return { gros: `${brief.montant.toLocaleString("fr-FR")} €`, petit: "par créateur" };
    }
    if (taux) return { gros: taux, petit: "de commission" };
    return null;
  })();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-5 py-6 sm:py-10">
      <div className="rounded-3xl border border-zinc-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,.04),0_24px_48px_-28px_rgba(0,0,0,.35)]">
        <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-purple-950 to-zinc-900 px-6">
          <p className="text-center font-display text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
            {brief.marque}
          </p>
        </div>

        <div className="px-2 pb-2 pt-4">
          <span className="inline-block rounded-full bg-purple-50 px-3 py-1 text-[11px] font-semibold text-purple-700">
            {LIBELLES_TYPE[brief.type] ?? brief.type}
          </span>

          {brief.produit && (
            <p className="mt-3 text-[15px] font-semibold leading-snug text-ink">{brief.produit}</p>
          )}

          {remuneration && (
            <p className="mt-4 font-display text-3xl font-black leading-none tabular-nums tracking-tight text-ink">
              {remuneration.gros}
              <span className="ml-2 align-middle text-xs font-medium text-zinc-500">
                {remuneration.petit}
              </span>
            </p>
          )}

          {brief.spots !== null && (
            <p className="mt-2 text-[11px] font-medium text-zinc-400">
              {brief.spots} place{brief.spots > 1 ? "s" : ""} sur cette campagne
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
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
