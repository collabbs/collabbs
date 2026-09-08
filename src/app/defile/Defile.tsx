"use client";

import { useState } from "react";
import Link from "next/link";
import { useStockageLocal } from "@/hooks/useStockageLocal";
import { CLE_INTERETS, listeDeTextes } from "@/lib/quiz";
import type { BriefDefile } from "@/lib/defile";
import CarteBrief, { type Direction } from "./CarteBrief";
import EcranMatch from "./EcranMatch";
import EcranRelance from "./EcranRelance";
import { FicheBrief } from "./Fiche";

/**
 * Le défilé, côté créateur.
 *
 * ─── Où se pose le mur ───
 * Faire défiler ne demande rien. Mais marquer son intérêt, c'est envoyer un
 * signal à quelqu'un — et ça exige une identité. Le mur se pose donc là, et
 * pas avant : on ne demande jamais de compte à quelqu'un qui n'a rien voulu.
 *
 * ─── Quand on abandonne, on va vers l'explication ───
 * Quelqu'un qui arrive au bout du paquet sans avoir rien retenu n'abandonne
 * pas : il n'a pas compris ce qu'il regardait. On l'envoie sur `/decouvrir`
 * plutôt que de lui tendre un formulaire — un formulaire à quelqu'un qui n'a
 * pas compris ne se remplit jamais.
 *
 * ─── Ce qui n'est pas là, volontairement ───
 * Pas de compteur « 4 sur 12 ». On ne montre jamais le fond du paquet : c'est
 * ce qui fait qu'un catalogue de 25 fiches paraît vide alors que les mêmes 25
 * font défiler longtemps.
 */
/** Nombre d'intérêts au bout duquel on demande le compte.
 *
 * Cinq, pas trois ni dix. Trois, c'est trop tôt : on n'a pas encore assez à
 * perdre pour que la demande pèse. Dix, c'est après la lassitude — la moitié
 * des gens ont déjà refermé. */
const RELANCE_AU = 5;

export default function Defile({
  briefs,
  apercuMatch,
}: {
  briefs: BriefDefile[];
  /** Aperçu de l'écran de match, demandé par `?apercu=match`. */
  apercuMatch?: boolean;
}) {
  const [interetsBrut, setInterets] = useStockageLocal<string[]>(CLE_INTERETS, []);
  // Une valeur qui n'est pas un tableau ferait lever `.includes` et tomber la
  // page. On répare, on ne fait pas confiance.
  const interets = listeDeTextes(interetsBrut);
  const [index, setIndex] = useState(0);
  // Une seule interruption : la reproposer ferait partir pour de bon.
  const [relance, setRelance] = useState(false);
  const [dejaRelance, setDejaRelance] = useState(false);
  const [match, setMatch] = useState<BriefDefile | null>(null);
  const [fiche, setFiche] = useState<BriefDefile | null>(null);
  // Sortie commandée par les boutons : la carte doit partir du bon côté avant
  // que la pile n'avance, exactement comme au glissement.
  const [sortieForcee, setSortieForcee] = useState<Direction | null>(null);

  const brief = briefs[index];
  const suivant = briefs[index + 1];
  const fini = index >= briefs.length;

  function avancer() {
    setIndex((i) => i + 1);
  }

  function interesse() {
    if (!brief) return;
    const nouveaux = interets.includes(brief.id) ? interets : [...interets, brief.id];
    if (nouveaux.length !== interets.length) setInterets(nouveaux);

    // ─── On demande le compte au moment du DÉSIR ───
    //
    // Il n'était proposé qu'après un match ou une fois le paquet vide.
    // Quelqu'un qui retenait six campagnes puis refermait n'était jamais
    // sollicité, alors qu'il venait de faire exactement ce qu'on espérait.
    // On demandait au moment de la lassitude, pas au moment de l'envie.
    if (!dejaRelance && nouveaux.length >= RELANCE_AU) {
      setDejaRelance(true);
      setRelance(true);
    }
    // Match SEULEMENT si la marque avait déjà marqué son intérêt. On ne
    // fabrique pas de réciprocité : annoncer un match à quelqu'un que personne
    // n'attend, c'est promettre une réponse qui ne viendra pas — et c'est pire
    // que de ne rien promettre.
    if (brief.dejaInteressee || apercuMatch) setMatch(brief);
    avancer();
  }

  function decider(d: Direction) {
    if (d === "droite") interesse();
    else avancer();
  }

  /** Depuis les boutons : on anime, PUIS on décide. */
  function deciderAvecSortie(d: Direction) {
    if (sortieForcee) return;
    setSortieForcee(d);
    window.setTimeout(() => {
      decider(d);
      setSortieForcee(null);
    }, 450);
  }

  /* ──────────────────────────────────────────── fin du paquet, ou le mur ── */
  if (fini) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-6 py-12 text-center">
        {interets.length > 0 ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
              {interets.length === 1 ? "1 coup de cœur" : `${interets.length} coups de cœur`}
            </p>
            <h1 className="font-display mt-3 text-[28px] font-black leading-[1.12] tracking-tight text-ink sm:text-4xl">
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
              className="mt-7 flex min-h-[58px] w-full max-w-xs items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 text-base font-bold text-white transition hover:opacity-90"
            >
              Me faire connaître
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-[28px] font-black leading-[1.12] tracking-tight text-ink sm:text-4xl">
              Rien ne t&apos;a parlé&nbsp;?
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

  /* ────────────────────────────────────────────── la pile, plein écran ──── */
  return (
    <>
      {match && (
        <EcranMatch brief={match} apercu={apercuMatch} onContinuer={() => setMatch(null)} />
      )}
      {relance && !match && (
        <EcranRelance
          // Les briefs retenus, pas leur nombre : c'est en les revoyant qu'on
          // mesure ce qu'on perdrait.
          retenus={briefs.filter((b) => interets.includes(b.id))}
          nombre={interets.length}
          cote="createur"
          onContinuer={() => setRelance(false)}
        />
      )}
      {fiche && <FicheBrief brief={fiche} onFermer={() => setFiche(null)} />}

      <div className="mx-auto flex h-dvh w-full max-w-md flex-col px-4 pb-6">
        <div className="relative min-h-0 flex-1">
          {suivant && <CarteBrief key={suivant.id} brief={suivant} enArriere />}
          <CarteBrief
            key={brief.id}
            brief={brief}
            onDecision={decider}
            onOuvrir={() => setFiche(brief)}
            sortirVers={sortieForcee}
          />
        </div>

        {/* Boutons ronds sous la carte. Ils restent parce qu'un geste ne se fait
            ni au clavier ni au lecteur d'écran — mais ils ne volent pas la
            vedette au glissement, qui est la vraie interaction. */}
        <div className="mt-5 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => deciderAvecSortie("gauche")}
            aria-label="Passer"
            className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-200 bg-white text-2xl text-rose-500 shadow-[0_8px_20px_-10px_rgba(0,0,0,.4)] transition hover:scale-105 active:scale-95"
          >
            ✕
          </button>
          <button
            type="button"
            onClick={() => deciderAvecSortie("droite")}
            aria-label="Ça m'intéresse"
            className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-3xl text-white shadow-[0_12px_28px_-10px_rgba(168,85,247,.8)] transition hover:scale-105 active:scale-95"
          >
            ♥
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] font-medium text-zinc-400">
          Fais glisser — à droite si ça t&apos;intéresse. Touche la carte pour en
          lire plus.
        </p>
      </div>
    </>
  );
}
