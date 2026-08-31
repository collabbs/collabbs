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
 * ─── L'abonnement n'ouvre pas de portes, il achète un taux ───
 * C'est ce que font Collabstr (10 % → 5 %) et Insense (20 % → 7 %), et c'est
 * ce qui rend l'abonnement calculable par la marque : « ce mois-ci, tu aurais
 * économisé X € ». Un plan gratuit amputé ferait fuir au moment exact où la
 * marque découvre le produit.
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
};

export const TARIFS: Record<Plan, Tarif> = {
  free: { libelle: "Gratuit", prix: 0, tauxCollab: 0.1, tauxAffiliation: 0.2 },
  growth: { libelle: "Growth", prix: 99, tauxCollab: 0.08, tauxAffiliation: 0.18 },
  scale: { libelle: "Scale", prix: 299, tauxCollab: 0.05, tauxAffiliation: 0.15 },
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
