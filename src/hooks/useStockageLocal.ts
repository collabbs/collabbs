"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Lire et écrire une valeur dans le stockage du navigateur, proprement.
 *
 * ─── Pourquoi pas un simple useEffect ───
 * Le réflexe est de lire `localStorage` dans un effet et d'appeler `setState`.
 * React le déconseille, et son linter le refuse : ça déclenche un rendu en
 * cascade — un premier avec la valeur vide, un second avec la vraie. Sur un
 * outil qui affiche des montants, cela veut dire un clignotement à chaque
 * ouverture.
 *
 * `useSyncExternalStore` est fait exactement pour ça : le stockage du
 * navigateur EST une source externe, au même titre qu'une connexion réseau. On
 * s'y abonne, on en lit un instantané, et React s'occupe du reste — y compris
 * du rendu serveur, où l'instantané est simplement la valeur par défaut.
 *
 * ─── L'abonnement sert vraiment ───
 * L'évènement `storage` se déclenche quand un AUTRE onglet modifie la même clé.
 * Sans lui, deux onglets ouverts sur le même outil divergeraient en silence, et
 * le dernier fermé écraserait l'autre.
 */
export function useStockageLocal<T>(
  cle: string,
  valeurParDefaut: T,
): [T, (maj: T | ((prec: T) => T)) => void] {
  const sabonner = useCallback(
    (auChangement: () => void) => {
      const surStorage = (e: StorageEvent) => {
        if (e.key === null || e.key === cle) auChangement();
      };
      window.addEventListener("storage", surStorage);
      window.addEventListener(EVENEMENT_LOCAL, auChangement);
      return () => {
        window.removeEventListener("storage", surStorage);
        window.removeEventListener(EVENEMENT_LOCAL, auChangement);
      };
    },
    [cle],
  );

  // L'instantané doit être STABLE entre deux rendus quand rien n'a changé,
  // sinon React reboucle indéfiniment. On mémorise donc la dernière chaîne lue
  // et l'objet qui en a été désérialisé.
  const instantane = useCallback((): T => {
    let brut: string | null = null;
    try {
      brut = window.localStorage.getItem(cle);
    } catch {
      /* mode privé, stockage désactivé */
    }
    if (brut === null) return valeurParDefaut;
    const cache = memoire.get(cle);
    if (cache && cache.brut === brut) return cache.valeur as T;
    try {
      const valeur = JSON.parse(brut) as T;
      memoire.set(cle, { brut, valeur });
      return valeur;
    } catch {
      // Contenu illisible — une version antérieure du format, par exemple.
      // On repart de la valeur par défaut plutôt que de faire tomber l'écran.
      return valeurParDefaut;
    }
  }, [cle, valeurParDefaut]);

  const surServeur = useCallback(() => valeurParDefaut, [valeurParDefaut]);

  const valeur = useSyncExternalStore(sabonner, instantane, surServeur);

  const ecrire = useCallback(
    (maj: T | ((prec: T) => T)) => {
      const suivante =
        typeof maj === "function" ? (maj as (prec: T) => T)(instantane()) : maj;
      try {
        const brut = JSON.stringify(suivante);
        window.localStorage.setItem(cle, brut);
        memoire.set(cle, { brut, valeur: suivante });
      } catch {
        /* quota plein : on garde au moins la valeur en mémoire pour la session */
        memoire.set(cle, { brut: "", valeur: suivante });
      }
      window.dispatchEvent(new Event(EVENEMENT_LOCAL));
    },
    [cle, instantane],
  );

  return [valeur, ecrire];
}

/**
 * Efface des clés et prévient tous les composants abonnés.
 *
 * Écrit pour le parcours d'entrée : sans ça, quelqu'un qui a répondu au
 * questionnaire ne peut plus jamais le refaire — sa carte est gardée, et rien
 * ne permet de repartir de zéro. Le nom de l'évènement étant privé à ce
 * module, la remise à zéro ne peut se faire QUE d'ici.
 *
 * Le cache `memoire` n'a pas besoin d'être purgé : `instantane` renvoie la
 * valeur par défaut dès que la clé est absente, sans le consulter.
 */
export function oublierStockageLocal(cles: readonly string[]): void {
  for (const cle of cles) {
    try {
      window.localStorage.removeItem(cle);
    } catch {
      /* mode privé, stockage désactivé */
    }
    memoire.delete(cle);
  }
  window.dispatchEvent(new Event(EVENEMENT_LOCAL));
}

/** `storage` ne se déclenche pas dans l'onglet qui écrit : on s'en fabrique un. */
const EVENEMENT_LOCAL = "collabbs:stockage-local";

/** Dernière chaîne lue et objet correspondant, par clé. Voir `instantane`. */
const memoire = new Map<string, { brut: string; valeur: unknown }>();
