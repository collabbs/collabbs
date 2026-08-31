/**
 * La grille tarifaire de Collabbs, en un seul endroit.
 *
 * ─── Le principe, et il n'a qu'une phrase ───
 * **C'est la marque qui paie.** Le créateur touche exactement le montant
 * annoncé, jamais un centime de moins. La commission s'AJOUTE au prix au lieu
 * d'être prélevée sur la part du créateur.
 *
 * Ce n'était pas le cas jusqu'ici : sur une collaboration, les 10 % étaient
 * déduits du créateur (il recevait 270 € sur 300 €) pendant que la page
 * d'accueil promettait « 100 % gratuit, à vie » aux créateurs. Le calcul
 * montre que la bascule ne coûte rien à Collabbs — 45 centimes d'écart sur une
 * collaboration de 300 € — parce que les frais Stripe s'appliquent des deux
 * côtés de la même façon. Ce qui change, c'est qui ressent le prélèvement, et
 * ce que le produit a le droit d'affirmer.
 *
 * ─── Deux assiettes, deux taux ───
 * · Ce qui passe par le SÉQUESTRE (forfait, UGC, booking direct) : un
 *   pourcentage du montant de la collaboration.
 * · Ce qui passe par la PROVISION (affiliation, code promo, CPA) : un
 *   pourcentage de la commission versée au créateur — soit environ 2 % du
 *   chiffre d'affaires généré, ce qui est la bonne façon de l'annoncer.
 *
 * ─── L'abonnement achète d'abord un taux, et une capacité ───
 * Le taux d'abord, parce que c'est ce qui rend l'abonnement calculable par la
 * marque : « ce mois-ci, tu aurais économisé X € ». C'est ce que font
 * Collabstr (10 % → 5 %) et Insense (20 % → 7 %).
 *
 * Et une capacité : le nombre de campagnes ouvertes EN MÊME TEMPS. La règle
 * qui décide de ce qu'on limite tient en une phrase : **on limite la vitrine,
 * jamais la caisse.** Ouvrir une deuxième campagne est un geste de croissance,
 * on peut demander à le payer. Encaisser une collaboration, verser un
 * créateur, honorer un contrat signé : jamais. Bloquer ça reviendrait à
 * bloquer le chiffre d'affaires de la marque — et le nôtre avec.
 *
 * Corollaire, écrit ici parce qu'il est facile à oublier : la fin d'un
 * abonnement NE FERME PAS les campagnes déjà ouvertes. Elle empêche d'en
 * ouvrir de nouvelles. Fermer d'un coup quatre campagnes actives laisserait
 * des créateurs en plan au milieu de collaborations en cours.
 */

/** Les plans, dans l'ordre croissant. */
export const PLANS = ["free", "growth", "scale"] as const;
export type Plan = (typeof PLANS)[number];

type Tarif = {
  libelle: string;
  /** Prix mensuel de l'abonnement, en euros. */
  prix: number;
  /** Part prélevée sur une collaboration (séquestre). */
  tauxCollab: number;
  /** Part prélevée sur une commission d'affiliation (provision). */
  tauxAffiliation: number;
  /**
   * Campagnes ouvertes simultanément. `null` = sans limite.
   *
   * Ne compte QUE les campagnes actives : un brouillon ne coûte rien à
   * personne, et une campagne terminée non plus. La marque reste donc libre
   * de préparer autant de campagnes qu'elle veut et de les faire tourner
   * l'une après l'autre — c'est la simultanéité qui se paie.
   */
  campagnesActives: number | null;
};

export const TARIFS: Record<Plan, Tarif> = {
  free: { libelle: "Gratuit", prix: 0, tauxCollab: 0.1, tauxAffiliation: 0.2, campagnesActives: 1 },
  growth: { libelle: "Growth", prix: 99, tauxCollab: 0.08, tauxAffiliation: 0.18, campagnesActives: 5 },
  scale: { libelle: "Scale", prix: 299, tauxCollab: 0.05, tauxAffiliation: 0.15, campagnesActives: null },
};

/**
 * Un plan inconnu — colonne absente, valeur héritée, marque créée avant les
 * abonnements — vaut « gratuit ». Jamais l'inverse : on ne facture pas moins
 * par accident, et on n'applique pas un tarif avantageux à qui ne l'a pas
 * souscrit.
 */
export function planValide(valeur: string | null | undefined): Plan {
  return (PLANS as readonly string[]).includes(valeur ?? "") ? (valeur as Plan) : "free";
}

export function tauxCollab(plan?: string | null): number {
  return TARIFS[planValide(plan)].tauxCollab;
}

export function tauxAffiliation(plan?: string | null): number {
  return TARIFS[planValide(plan)].tauxAffiliation;
}

/** Combien de campagnes ce plan autorise à faire tourner en même temps. */
export function limiteCampagnesActives(plan?: string | null): number | null {
  return TARIFS[planValide(plan)].campagnesActives;
}
