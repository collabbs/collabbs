"use client";

import { useMemo, useState } from "react";
import { useClavier } from "./useClavier";
import { enregistrerVues } from "./actions";
import Link from "next/link";
import { useStockageLocal } from "@/hooks/useStockageLocal";
import { CLE_REPERAGES, CLE_VUES, listeDeTextes } from "@/lib/quiz";
import type { MarketplaceCreator } from "@/lib/creators-data";
import CarteCreateur from "./CarteCreateur";
import type { Direction } from "./CarteBrief";
import { FicheCreateur } from "./Fiche";
import EcranMatchCreateur from "./EcranMatchCreateur";
import EcranRelance from "./EcranRelance";

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


export default function DefileCreateurs({
  createurs,
  apercuMatch,
  connecte,
}: {
  createurs: MarketplaceCreator[];
  /** Connecté : la mémoire du paquet peut suivre la personne. */
  connecte?: boolean;
  /** Aperçu de l'écran de match, demandé par `?apercu=match`. */
  apercuMatch?: boolean;
}) {
  const [reperagesBrut, setReperages] = useStockageLocal<string[]>(CLE_REPERAGES, []);
  // Une valeur qui n'est pas un tableau ferait lever `.includes` et tomber la
  // page. On répare, on ne fait pas confiance.
  const reperages = listeDeTextes(reperagesBrut);
  const [vuesBrut, setVues] = useStockageLocal<string[]>(CLE_VUES, []);
  const vues = listeDeTextes(vuesBrut);

  // Même règle que côté créateur : un paquet borné, sans ce qui a déjà défilé.
  // Figé au montage, sinon il bougerait sous les doigts à chaque décision.
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
      createurs
        .filter((c) => !vues.includes(c.id) || enCoursDeLecture.includes(c.id))
        .slice(0, PAQUET_DU_JOUR),
    [createurs, vues, enCoursDeLecture],
  );

  const [index, setIndex] = useState(0);
  const [fiche, setFiche] = useState<MarketplaceCreator | null>(null);
  // Une seule interruption : la reproposer ferait partir pour de bon.
  const [relance, setRelance] = useState(false);
  const [dejaRelance, setDejaRelance] = useState(false);
  const [match, setMatch] = useState<MarketplaceCreator | null>(null);
  // Voir `Defile` : sans ça, les boutons faisaient disparaître la carte sans
  // qu'on voie de quel côté elle partait.
  const [sortieForcee, setSortieForcee] = useState<Direction | null>(null);

  const createur = paquet[index];
  const suivant = paquet[index + 1];
  const fini = index >= paquet.length;

  function avancer() {
    // ⚠️ Forme FONCTIONNELLE, pas `[...vues, id]`.
    //
    // `vues` est figé par la fermeture de ce rendu. En enchaînant les
    // décisions, chaque écriture repartait de la même base et écrasait la
    // précédente : mesuré, un second paquet de douze cartes ne mémorisait
    // rien du tout, et les mêmes revenaient le lendemain.
    if (createur) {
      const id = createur.id;
      setEnCoursDeLecture((liste) => (liste.includes(id) ? liste : [...liste, id]));
      // Connecté, la mémoire suit la personne d'un appareil à l'autre — et
      // c'est elle qui rend le rappel possible : on ne peut pas écrire
      // « 35 nouvelles t'attendent » à quelqu'un dont on ignore ce qu'il a vu.
      if (connecte) void enregistrerVues([id]);
      setVues((v) => (Array.isArray(v) && v.includes(id) ? v : [...listeDeTextes(v), id]));
    }
    setIndex((i) => i + 1);
  }

  function reperer() {
    if (!createur) return;
    const nouveaux = reperages.includes(createur.id)
      ? reperages
      : [...reperages, createur.id];
    if (nouveaux.length !== reperages.length) setReperages(nouveaux);

    // Même règle que côté créateur : on demande le compte quand la personne a
    // quelque chose à perdre, pas quand elle s'est lassée.
    if (!dejaRelance && nouveaux.length >= RELANCE_AU) {
      setDejaRelance(true);
      setRelance(true);
    }
    // Aucun match spontané de ce côté : un match suppose que le créateur ait
    // AUSSI marqué son intérêt, ce qu'il ne peut pas faire sans compte. On ne
    // fabrique pas de réciprocité — une marque à qui on annonce un match et
    // qui n'obtient jamais de réponse ne revient pas.
    if (apercuMatch) setMatch(createur);
    avancer();
  }

  function decider(d: Direction) {
    if (d === "droite") reperer();
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
    }, 240);
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
            {/* Connectée, la marque n'a pas de compte à créer : elle a des
                créateurs à contacter depuis son espace. */}
            <Link
              href={connecte ? "/creators" : "/signup?role=brand"}
              className="mt-7 flex min-h-[58px] w-full max-w-xs items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 text-base font-bold text-white transition hover:opacity-90"
            >
              {connecte ? "Voir leurs profils" : "Les contacter"}
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
              href={connecte ? "/dashboard" : "/decouvrir"}
              className="mt-7 flex min-h-[58px] w-full max-w-xs items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 text-base font-bold text-white transition hover:opacity-90"
            >
              {connecte ? "Retour à mon espace" : "Découvrir Collabbs"}
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {fiche && <FicheCreateur createur={fiche} onFermer={() => setFiche(null)} />}
      {match && (
        <EcranMatchCreateur
          createur={match}
          apercu={apercuMatch}
          onContinuer={() => setMatch(null)}
        />
      )}
      {relance && !match && (
        <EcranRelance
          // Elle vient de choisir cinq personnes : elle doit les revoir.
          retenus={createurs
            .filter((c) => reperages.includes(c.id))
            .map((c) => ({
              id: c.id,
              image: c.photo,
              legende: c.name,
              couleur: "#3b2a52",
            }))}
          nombre={reperages.length}
          restants={Math.max(0, createurs.length - vues.length - index - 1)}
          cote="marque"
          onContinuer={() => setRelance(false)}
        />
      )}
      <div className="mx-auto flex h-full w-full max-w-md flex-col px-4 pb-6">
      <div className="relative min-h-0 flex-1">
        {suivant && <CarteCreateur key={suivant.id} createur={suivant} enArriere />}
        <CarteCreateur
          key={createur.id}
          createur={createur}
          onDecision={decider}
          onOuvrir={() => setFiche(createur)}
          sortirVers={sortieForcee}
        />
      </div>

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
          aria-label="Ce créateur m'intéresse"
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
