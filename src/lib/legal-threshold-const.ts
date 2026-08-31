/**
 * Le seuil légal, isolé pour être lisible depuis le navigateur.
 *
 * `lib/legal-threshold` est `server-only` : il interroge la base pour calculer
 * un cumul. La CONSTANTE, elle, n'a rien de secret et doit pouvoir s'afficher
 * dans un composant client — sans quoi l'écran répéterait « 1 000 € » en dur à
 * plusieurs endroits, avec la garantie qu'un jour l'un d'eux serait oublié.
 */

/** Décret n° 2025-1137 : contrat écrit obligatoire au-delà, par couple et par année civile. */
export const LEGAL_THRESHOLD = 1000;
