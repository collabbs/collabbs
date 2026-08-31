/**
 * L'invitation d'un créateur par une marque.
 *
 * ─── Ce qui manquait, et pourquoi ça compte ───
 * Depuis la migration 0003, la table `applications` porte une colonne
 * `initiated_by` avec deux valeurs : `creator` (le créateur postule) et
 * `brand` (la marque invite). La politique RLS autorise les deux depuis le
 * premier jour. Mais aucun code n'a jamais écrit `brand` : concrètement, une
 * marque ne pouvait pas aller chercher un créateur, seulement attendre qu'on
 * vienne à elle.
 *
 * Sur une place de marché qui démarre, c'est bloquant : il n'y a personne pour
 * postuler. La marque qui arrive voit un catalogue de créateurs et aucun moyen
 * de leur parler.
 *
 * ─── La symétrie, qui est le vrai sujet ───
 * Une ligne d'`applications` n'a pas un sens mais deux, et **ils n'ont pas le
 * même décideur** :
 *
 *  · `initiated_by = 'creator'` — le créateur demande, **la marque** tranche.
 *  · `initiated_by = 'brand'`   — la marque propose, **le créateur** tranche.
 *
 * Tout le reste du produit découle de là. Une invitation comptée comme une
 * candidature ferait disparaître la campagne de l'écran du créateur (il
 * passerait pour « déjà candidat »), gonflerait le compteur de candidatures à
 * traiter de la marque avec ses propres envois, et laisserait la marque
 * accepter une invitation à la place du créateur.
 */

/** Qui a pris l'initiative de la mise en relation. */
export type Initiateur = "creator" | "brand";

/**
 * Où en est la mise en relation.
 *
 * Les quatre valeurs de l'énumération `application_status`, `withdrawn`
 * compris — c'est un créateur qui a retiré sa candidature, et une ligne
 * retirée ne se décide plus par personne.
 */
export type StatutCandidature = "pending" | "accepted" | "rejected" | "withdrawn";

/**
 * Qui a le pouvoir de dire oui ou non — c'est-à-dire l'autre partie que celle
 * qui a fait le premier pas.
 */
export function decideur(initiateur: Initiateur): "brand" | "creator" {
  return initiateur === "creator" ? "brand" : "creator";
}

/**
 * Ce rôle peut-il trancher cette ligne ?
 *
 * Sert de garde unique aux deux actions serveur, plutôt que de refaire le
 * raisonnement des deux côtés — c'est exactement le genre de règle qu'on
 * écrit deux fois et qu'on corrige une seule.
 */
export function peutDecider(
  role: "brand" | "creator",
  initiateur: Initiateur,
  statut: StatutCandidature,
): boolean {
  return statut === "pending" && role === decideur(initiateur);
}

/**
 * Le tri des créateurs à inviter.
 *
 * Une marque qui coche vingt profils d'un coup en a forcément déjà invité
 * certains, et travaille déjà avec d'autres. Renvoyer une erreur pour ça
 * serait absurde : on invite ceux qu'on peut, on annonce le reste.
 *
 * `dejaEnRelation` couvre les deux cas d'un même problème — une candidature
 * reçue ou une invitation déjà envoyée — parce que la contrainte d'unicité
 * `(campaign_id, creator_id)` ne fait pas la différence non plus.
 */
export function createursAInviter(
  choisis: readonly string[],
  dejaEnRelation: readonly string[],
): { aInviter: string[]; ignores: string[] } {
  const deja = new Set(dejaEnRelation);
  const vus = new Set<string>();
  const aInviter: string[] = [];
  const ignores: string[] = [];

  for (const id of choisis) {
    // Un même identifiant deux fois dans la sélection n'est pas une erreur de
    // la marque : c'est un doublon de formulaire. Il ne doit pas produire deux
    // lignes, ni compter deux fois dans le message.
    if (vus.has(id)) continue;
    vus.add(id);
    if (deja.has(id)) ignores.push(id);
    else aInviter.push(id);
  }
  return { aInviter, ignores };
}

/**
 * Le compte rendu, en français, de ce qui vient de se passer.
 *
 * Écrit ici et pas dans le composant parce que c'est la seule phrase que la
 * marque va lire : si elle coche cinq profils et qu'il n'en part que deux,
 * elle doit comprendre pourquoi sans avoir à comparer des listes.
 */
export function resumeInvitations(envoyees: number, ignores: number): string {
  if (envoyees === 0 && ignores === 0) return "Aucun créateur sélectionné.";
  if (envoyees === 0) {
    return ignores === 1
      ? "Ce créateur est déjà en relation avec cette campagne."
      : `Ces ${ignores} créateurs sont déjà en relation avec cette campagne.`;
  }
  const debut =
    envoyees === 1 ? "Invitation envoyée." : `${envoyees} invitations envoyées.`;
  if (ignores === 0) return debut;
  return ignores === 1
    ? `${debut} 1 créateur était déjà en relation avec cette campagne.`
    : `${debut} ${ignores} créateurs étaient déjà en relation avec cette campagne.`;
}

/**
 * Combien de créateurs on accepte d'inviter en une fois.
 *
 * Le plafond n'est pas une limite commerciale : c'est une limite de dégâts.
 * Une invitation envoie une notification à quelqu'un ; un formulaire trafiqué
 * avec dix mille identifiants ne doit pas pouvoir s'en servir pour arroser la
 * base. Cinquante couvre très largement le geste réel — cocher une shortlist.
 */
export const MAX_INVITATIONS_PAR_ENVOI = 50;
