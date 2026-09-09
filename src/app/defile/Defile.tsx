"use client";

import { useMemo, useState } from "react";
import { useClavier } from "./useClavier";
import Link from "next/link";
import { useStockageLocal } from "@/hooks/useStockageLocal";
import { CLE_INTERETS, CLE_VUES, listeDeTextes } from "@/lib/quiz";
import type { BriefDefile } from "@/lib/defile";
import CarteBrief, { photoDuBrief, remunerationLisible, type Direction } from "./CarteBrief";
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

/** Taille du paquet du jour.
 *
 * Douze, pas quarante. Un paquet qui ne finit jamais n'a aucune raison de vous
 * faire revenir : on l'abandonne en cours, et on n'y repense pas. Un paquet
 * qu'on TERMINE se referme sur une promesse — « d'autres demain » — et c'est
 * elle qui fait le rendez-vous. */
const PAQUET_DU_JOUR = 12;


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
  const [vuesBrut, setVues] = useStockageLocal<string[]>(CLE_VUES, []);
  const vues = listeDeTextes(vuesBrut);

  /* ═══ LE PAQUET DU JOUR ═══

     On recevait TOUT le catalogue et on le faisait défiler sans fin. Deux
     conséquences : le paquet remontrait les mêmes cartes à chaque visite, et
     il ne se terminait jamais — donc il n'y avait aucun moment où l'on puisse
     dire « reviens demain ».

     On écarte ce qui a déjà défilé, et on borne. Le calcul est figé au
     montage : recalculer à chaque like ferait bouger le paquet sous les
     doigts. */
  /* ⚠️ Le paquet ne peut PAS être figé au montage.
     Le stockage local n'est lu qu'APRÈS l'hydratation : au premier rendu la
     mémoire est vide, donc un paquet figé là n'exclut rien et remontre les
     mêmes douze cartes. Mesuré — un second passage ne mémorisait rien, parce
     qu'il revoyait exactement ce qu'il avait déjà vu.

     Il se recalcule donc, mais sans jamais retirer une carte DÉJÀ EN COURS de
     lecture : sinon la pile se dérobe sous les doigts à chaque décision. */
  // Un ÉTAT, pas une référence : il est lu pendant le rendu pour composer
  // le paquet, donc React doit en être informé.
  const [enCoursDeLecture, setEnCoursDeLecture] = useState<string[]>([]);
  const paquet = useMemo(
    () =>
      briefs
        .filter((b) => !vues.includes(b.id) || enCoursDeLecture.includes(b.id))
        .slice(0, PAQUET_DU_JOUR),
    [briefs, vues, enCoursDeLecture],
  );

  const [index, setIndex] = useState(0);
  // Une seule interruption : la reproposer ferait partir pour de bon.
  const [relance, setRelance] = useState(false);
  const [dejaRelance, setDejaRelance] = useState(false);
  const [match, setMatch] = useState<BriefDefile | null>(null);
  const [fiche, setFiche] = useState<BriefDefile | null>(null);
  // Sortie commandée par les boutons : la carte doit partir du bon côté avant
  // que la pile n'avance, exactement comme au glissement.
  const [sortieForcee, setSortieForcee] = useState<Direction | null>(null);

  const brief = paquet[index];
  const suivant = paquet[index + 1];
  const fini = index >= paquet.length;

  function avancer() {
    // Vue veut dire vue : qu'on l'ait aimée ou passée, elle ne doit pas
    // revenir demain. C'est ce qui rend « nouvelles » vrai.
    // ⚠️ Forme FONCTIONNELLE, pas `[...vues, id]`.
    //
    // `vues` est figé par la fermeture de ce rendu. En enchaînant les
    // décisions, chaque écriture repartait de la même base et écrasait la
    // précédente : mesuré, un second paquet de douze cartes ne mémorisait
    // rien du tout, et les mêmes revenaient le lendemain.
    if (brief) {
      const id = brief.id;
      setEnCoursDeLecture((liste) => (liste.includes(id) ? liste : [...liste, id]));
      setVues((v) => (Array.isArray(v) && v.includes(id) ? v : [...listeDeTextes(v), id]));
    }
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

  // Sur ordinateur, les flèches font le même travail que le doigt : gauche
  // pour passer, droite pour garder. Rien de nouveau à apprendre.
  useClavier({
    actif: !fini && !match && !relance && !fiche,
    onGauche: () => deciderAvecSortie("gauche"),
    onDroite: () => deciderAvecSortie("droite"),
  });

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
    /* ═══ LA FIN DU PAQUET EST UN RENDEZ-VOUS ═══

       Cet écran disait « rien ne t'a parlé ? » — il traitait la fin comme un
       échec. Or on vient de terminer quelque chose : c'est le seul moment où
       l'on peut annoncer la suite sans forcer.

       Le nombre restant est CALCULÉ sur ce que le catalogue contient et ce
       qu'on a déjà vu. Une promesse chiffrée qui ne se vérifie pas se retourne
       au deuxième jour. */
    const restants = Math.max(0, briefs.length - vues.length);

    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          Paquet terminé
        </p>
        <h1 className="font-display mt-3 text-[28px] font-black leading-[1.12] tracking-tight text-ink sm:text-[34px]">
          {restants > 0 ? (
            <>
              <span className="bg-[linear-gradient(135deg,#5b21b6_0%,#7c3aed_50%,#06b6d4_100%)] bg-clip-text text-transparent">
                {restants} autres
              </span>{" "}
              t&apos;attendent demain.
            </>
          ) : (
            <>
              Tu as tout vu.
              <br />
              D&apos;autres arrivent chaque semaine.
            </>
          )}
        </h1>

        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-zinc-500">
          {interets.length > 0
            ? `Tu en as retenu ${interets.length}. Crée ton compte pour les garder et monétiser tes vidéos avec des collaborations.`
            : "Crée ton compte pour monétiser tes vidéos avec des collaborations — et être prévenu des prochaines."}
        </p>

        <Link
          href="/signup?role=creator"
          className="mt-7 flex min-h-[58px] w-full max-w-xs items-center justify-center rounded-xl bg-ink px-6 text-[16px] font-semibold text-white transition hover:opacity-90"
        >
          Créer mon compte
        </Link>

        <Link href="/decouvrir" className="mt-4 text-[14px] font-medium text-zinc-400 transition hover:text-ink">
          C&apos;est quoi Collabbs&nbsp;?
        </Link>
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
          retenus={briefs
            .filter((b) => interets.includes(b.id))
            .map((b) => ({
              id: b.id,
              image: photoDuBrief(b),
              legende: remunerationLisible(b)?.gros ?? b.marque,
              couleur: b.couleurMarque ?? "#1b1b21",
            }))}
          nombre={interets.length}
          // Ce qui reste VRAIMENT à voir : la taille du paquet moins ce qui
          // a déjà défilé. Une abondance annoncée au hasard se dément vite.
          restants={Math.max(0, briefs.length - vues.length - index - 1)}
          cote="createur"
          onContinuer={() => setRelance(false)}
        />
      )}
      {fiche && <FicheBrief brief={fiche} onFermer={() => setFiche(null)} />}

      <div className="mx-auto flex h-full w-full max-w-md flex-col px-4 pb-6">
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
          {/* Le clavier n'existe que sur grand écran : l'annoncer sur téléphone
              serait proposer un geste impossible. */}
          <span className="sm:hidden">Fais glisser. Touche la carte pour en lire plus.</span>
          <span className="hidden sm:inline">
            Fais glisser, ou utilise ← et →. Clique la carte pour en lire plus.
          </span>
        </p>
      </div>
    </>
  );
}
