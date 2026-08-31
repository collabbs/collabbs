/**
 * Repères de temps, hors composants.
 *
 * `Date.now()` appelé pendant le rendu d'un composant est refusé par la règle
 * de pureté de React : deux rendus successifs donneraient deux valeurs. Isoler
 * le calcul ici règle le problème à la source plutôt que de désactiver la
 * règle — et donne un nom à l'intention.
 */

/** Date ISO d'il y a `jours` jours. Sert aux fenêtres glissantes. */
export function ilYA(jours: number): string {
  return new Date(Date.now() - jours * 86400000).toISOString();
}

/** Vrai si cette date est passée. Une date absente n'est jamais échue. */
export function estEchu(date: string | null | undefined): boolean {
  return date != null && new Date(date).getTime() < Date.now();
}
