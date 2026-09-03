/**
 * Qui porte le risque quand les deux parties ne s'entendent plus.
 *
 * ─── Le trou que ceci ferme ───
 * `refundDeal` ne vérifiait que trois choses : appelant = la marque, un
 * paiement existe, il est en séquestre. AUCUNE condition sur la livraison. La
 * marque pouvait donc régler, recevoir la vidéo publiée, puis cliquer
 * « Rembourser » : le créateur avait publié une promotion payée, gratuitement,
 * sans recours dans le produit.
 *
 * C'est la promesse centrale de Collabbs, répétée sur la page d'accueil
 * (« le créateur est garanti d'être payé avant de publier ») et surtout écrite
 * dans le CONTRAT que les deux parties signent : « Collabbs séquestre les
 * fonds dès l'acceptation et les libère au bénéfice du créateur après
 * validation de la livraison. » Un engagement contractuel que la plateforme
 * ne tenait pas.
 *
 * ─── La règle retenue ───
 * Le remboursement reste nécessaire : une marque dont le créateur ne livre
 * jamais doit récupérer ses fonds. Il lui manquait sa condition.
 *
 *   **Tant que RIEN n'est livré, la marque peut reprendre ses fonds.**
 *   **Dès qu'un livrable est déposé, elle ne le peut plus** — il lui reste à
 *   valider, à demander une retouche, ou à laisser la libération automatique
 *   du cron `escrow-sla` faire son travail.
 *
 * Le déclencheur est le DÉPÔT (`submitted_at`), pas la validation : c'est le
 * moment où le créateur s'est dessaisi de son travail, donc celui où il
 * devient vulnérable.
 */

export type EtatLivrable = {
  submitted_at: string | null;
  done: boolean;
};

export type VerdictRemboursement =
  | { autorise: true }
  | { autorise: false; motif: string };

/**
 * La marque peut-elle encore reprendre ses fonds ?
 *
 * `done` est retenu en plus de `submitted_at` parce qu'un créateur peut
 * cocher « terminé » sur un livrable dont la preuve est ailleurs (une story
 * qui expire, un post déjà en ligne). Dans les deux cas il a livré.
 */
export function peutRembourser(livrables: EtatLivrable[]): VerdictRemboursement {
  const livre = livrables.some((l) => l.submitted_at !== null || l.done);
  if (!livre) return { autorise: true };
  return {
    autorise: false,
    motif:
      "Le créateur a déjà livré. Le remboursement unilatéral n'est plus possible : " +
      "valide la livraison, demande une retouche, ou contacte-nous si elle ne " +
      "correspond pas à ce qui était convenu.",
  };
}

/**
 * Message affiché à la marque à la place du bouton, quand elle ne peut plus
 * rembourser. Dit ce qui reste possible, jamais seulement ce qui ne l'est pas.
 */
export const EXPLICATION_REMBOURSEMENT_FERME =
  "Le créateur a livré : les fonds lui sont désormais destinés. Valide la livraison ou demande une retouche.";
