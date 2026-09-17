/**
 * Combien de fois un abonnement rapporte-t-il au créateur.
 *
 * ─── Pourquoi ça existe ───
 * Une vente e-commerce se produit une fois. Un abonnement se paie tous les
 * mois, et c'est ce qui rend l'affiliation SaaS intéressante pour un créateur :
 * 20 % de 29 € font 5,80 € une fois, ou 70 € sur douze mois. Le produit ne
 * savait dire que le premier cas.
 *
 * ─── Les trois réglages, et leur seule source ───
 * `1` = le premier paiement seulement (le comportement historique).
 * `N` = les N premiers paiements de chaque abonnement.
 * `0` = tous les paiements, sans limite.
 *
 * Zéro pour « illimité » est une convention qui se lit mal sur une ligne de
 * code isolée. C'est précisément pour ça que personne ne compare la valeur à
 * la main ailleurs : tout passe par ici.
 */

export const TOUS_LES_PAIEMENTS = 0;

/** Les choix proposés à la marque, dans l'ordre où on les présente. */
export const RYTHMES_COMMISSION: { valeur: number; label: string; detail: string }[] = [
  {
    valeur: 1,
    label: "Le premier paiement",
    detail: "Le créateur touche une fois, sur l'abonnement initial.",
  },
  {
    valeur: 3,
    label: "3 mois",
    detail: "Trois paiements commissionnés par abonné apporté.",
  },
  {
    valeur: 12,
    label: "12 mois",
    detail: "Un an de commissions — ce qui fait venir les créateurs.",
  },
  {
    valeur: TOUS_LES_PAIEMENTS,
    label: "À vie",
    detail: "Tant que l'abonné reste, le créateur touche.",
  },
];

/**
 * Ce paiement doit-il être commissionné ?
 *
 * `dejaCommissionnes` compte les paiements du MÊME abonnement qui ont déjà
 * rapporté. Une vente sans abonnement — l'e-commerce ordinaire — n'a rien
 * derrière elle et passe toujours.
 */
export function commissionDueSurCePaiement(
  paiementsCommissionnes: number,
  dejaCommissionnes: number,
): boolean {
  if (paiementsCommissionnes === TOUS_LES_PAIEMENTS) return true;
  // Une valeur absurde en base ne doit pas offrir une commission infinie : on
  // retombe sur le réglage le plus prudent, celui d'avant.
  const plafond = Number.isFinite(paiementsCommissionnes) && paiementsCommissionnes > 0
    ? paiementsCommissionnes
    : 1;
  return dejaCommissionnes < plafond;
}

/**
 * Un renouvellement échappe-t-il à la fenêtre d'attribution ?
 *
 * La fenêtre juge le PREMIER paiement : elle répond à « ce clic a-t-il encore
 * provoqué cet achat ? ». Un renouvellement au sixième mois n'est provoqué par
 * aucun clic — il découle d'un abonnement déjà attribué. Lui appliquer la
 * fenêtre de 30 jours le ferait basculer en revue manuelle, sur une commission
 * parfaitement due : la marque recevrait tous les mois une vente à trancher,
 * et finirait par ne plus les regarder.
 */
export function estUnRenouvellement(
  abonnement: string | null,
  dejaCommissionnes: number,
): boolean {
  return Boolean(abonnement) && dejaCommissionnes > 0;
}

/**
 * Ce que le créateur touchera en tout, annoncé avant qu'il s'engage.
 *
 * `tauxPourcent` est un POURCENTAGE : 20 pour 20 %, comme les colonnes
 * `commission_*` de la base. Le nommer simplement « taux » laissait planer le
 * doute entre 20 et 0,2 — un facteur cent sur de l'argent versé, et le genre
 * d'erreur qu'aucune relecture ne rattrape parce que le code a l'air juste.
 */
export function gainTotalAnnonce(
  montantMensuel: number,
  tauxPourcent: number,
  paiementsCommissionnes: number,
): { parPaiement: number; total: number | null } {
  const parPaiement = Math.round(montantMensuel * tauxPourcent) / 100;
  // « À vie » n'a pas de total : l'annoncer reviendrait à promettre une durée
  // que personne ne connaît.
  if (paiementsCommissionnes === TOUS_LES_PAIEMENTS) return { parPaiement, total: null };
  return { parPaiement, total: Math.round(parPaiement * paiementsCommissionnes * 100) / 100 };
}
