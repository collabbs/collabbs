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
  free: { libelle: "Gratuit", prix: 0, tauxCollab: 0.1, tauxAffiliation: 0.2, campagnesActives: 2 },
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

/**
 * ─── Le point d'indifférence entre deux plans ───
 *
 * À quelle dépense mensuelle en créateurs les deux plans coûtent-ils
 * exactement la même chose à la marque ? En dessous, le moins cher est celui
 * qui a le plus petit abonnement ; au-dessus, celui qui a le plus petit taux.
 *
 * Pourquoi ce calcul vit dans le code plutôt que dans un tableur : une grille
 * tarifaire peut être arithmétiquement absurde sans que personne s'en aperçoive
 * à l'œil. C'est le cas de la grille actuelle, et le constat mérite d'être
 * vérifiable à tout moment plutôt que redécouvert.
 *
 * Renvoie `null` quand les deux plans ont le même taux : il n'y a alors pas de
 * croisement, le moins cher l'est partout.
 */
export function depenseDIndifference(a: Plan, b: Plan): number | null {
  const A = TARIFS[a];
  const B = TARIFS[b];
  const ecartTaux = A.tauxCollab - B.tauxCollab;
  if (ecartTaux === 0) return null;
  const depense = (B.prix - A.prix) / ecartTaux;
  return depense > 0 ? Math.round(depense) : null;
}

/**
 * Le plan qui coûte le moins cher à une marque, pour une dépense donnée.
 *
 * Ne tient compte QUE du prix : ni du plafond de campagnes, ni des
 * fonctionnalités. C'est volontaire — c'est la question que se pose une marque
 * qui compare, et la réponse doit être calculée, pas plaidée.
 */
export function planLePlusEconomique(depenseMensuelle: number): Plan {
  return [...PLANS].sort(
    (x, y) =>
      TARIFS[x].prix + TARIFS[x].tauxCollab * depenseMensuelle -
      (TARIFS[y].prix + TARIFS[y].tauxCollab * depenseMensuelle),
  )[0];
}

/**
 * La fenêtre de dépense sur laquelle un plan est le moins cher de tous.
 *
 * ─── Pourquoi cette fonction existe ───
 * Un plan payant dont la fenêtre est vide, ou si étroite qu'aucun client réel
 * ne s'y trouve, ne se vendra jamais pour de bonnes raisons : il ne se vendra
 * que parce qu'on a plafonné quelque chose ailleurs. C'est un péage, pas une
 * offre, et un péage se paie une fois puis se résilie.
 *
 * Sur la grille au 31 août 2026, `growth` n'est le moins cher qu'entre 4 950 €
 * et 6 667 € de dépense mensuelle — une fenêtre de 1 717 €, soit 14 à 19
 * collaborations par mois à 350 €. Aucune marque du marché visé ne s'y trouve.
 *
 * `fin: null` signifie que le plan reste le moins cher indéfiniment au-delà.
 */
export function fenetreDOptimalite(plan: Plan): { debut: number; fin: number | null } | null {
  const PAS = 25;
  const MAX = 40_000;
  let debut: number | null = null;
  let fin: number | null = null;
  for (let d = 0; d <= MAX; d += PAS) {
    if (planLePlusEconomique(d) === plan) {
      if (debut === null) debut = d;
      fin = d;
    }
  }
  if (debut === null) return null;
  return { debut, fin: fin !== null && fin >= MAX ? null : fin };
}
