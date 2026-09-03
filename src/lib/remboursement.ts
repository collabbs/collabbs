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
  /** Une retouche a-t-elle été demandée et pas encore traitée ? */
  revision_requested: boolean;
  /**
   * Dernière modification de la ligne. Sert à mesurer le silence du créateur.
   *
   * Il n'existe pas de `revision_requested_at` en base, et en ajouter une
   * imposerait une migration pour un gain nul ici : tant que
   * `revision_requested` est vrai, la dernière écriture sur cette ligne EST la
   * demande de retouche (ou une reformulation de son message). Et si une autre
   * écriture venait la toucher, elle repousserait la date — donc elle
   * allongerait le délai laissé au créateur. L'imprécision joue en faveur de
   * celui qu'on protège, ce qui est le bon sens de l'erreur.
   */
  updated_at: string;
};

/**
 * Combien de jours le créateur a pour répondre à une demande de retouche
 * avant que la marque puisse reprendre ses fonds.
 *
 * Généreux à dessein. Un créateur peut être en tournage, en vacances, malade.
 * Deux semaines écartent tout doute sur le fait qu'il a abandonné, sans
 * immobiliser l'argent de la marque pendant des mois.
 */
export const JOURS_AVANT_ABANDON = 14;

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
export function peutRembourser(
  livrables: EtatLivrable[],
  maintenantMs: number = Date.now(),
): VerdictRemboursement {
  const livre = livrables.some((l) => l.submitted_at !== null || l.done);
  if (!livre) return { autorise: true };

  // ─── L'impasse que la règle ci-dessus créait ───
  //
  // Le créateur livre quelque chose d'inutilisable, la marque demande une
  // retouche, le créateur disparaît. La liberation automatique est bloquée
  // (`revision_requested`), et c'est juste : il ne doit pas être payé. Mais le
  // remboursement l'était aussi, et la clôture exige une validation que la
  // marque ne donnera jamais. Les fonds restaient bloqués POUR TOUJOURS, sans
  // issue pour personne.
  //
  // Une demande de retouche est un acte écrit, daté, notifié : la marque a dit
  // explicitement que le travail ne convient pas, et le créateur a eu une
  // vraie occasion de le reprendre. S'il ne répond pas dans le délai, on
  // considère qu'il a abandonné.
  //
  // Ça ne rouvre pas la faille d'origine : dès que le créateur redépose,
  // `revision_requested` retombe à faux et le remboursement se referme.
  const abandons = livrables.filter((l) => l.revision_requested);
  if (abandons.length > 0) {
    const limite = JOURS_AVANT_ABANDON * 86_400_000;
    const tousDepasses = abandons.every(
      (l) => maintenantMs - new Date(l.updated_at).getTime() >= limite,
    );
    if (tousDepasses) return { autorise: true };
  }

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
