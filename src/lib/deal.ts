import { TARIFS, tauxCollab } from "@/lib/tarifs";

// Helpers partagés pour le cycle de vie des deals (collaborations).

export type DealStatus = "negotiation" | "active" | "completed" | "cancelled";
export type DealFormat = "video_post" | "ugc" | "story" | "reel" | "live";

export const DEAL_FORMAT_LABEL: Record<DealFormat, string> = {
  video_post: "Vidéo postée",
  ugc: "Contenu UGC",
  story: "Story / Mention",
  reel: "Reel",
  live: "Live",
};

export const DEAL_STATUS_META: Record<
  DealStatus,
  { label: string; className: string }
> = {
  negotiation: { label: "En négociation", className: "bg-amber-50 text-amber-700" },
  active: { label: "En cours", className: "bg-blue-50 text-blue-700" },
  completed: { label: "Terminé", className: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Annulé", className: "bg-zinc-100 text-zinc-500" },
};

/**
 * Taux par défaut sur une collaboration — celui du plan gratuit.
 * La grille complète vit dans `lib/tarifs`.
 */
export const PLATFORM_FEE_RATE = TARIFS.free.tauxCollab;

/**
 * Décomposition d'une collaboration.
 *
 * `amount` est ce que touche le CRÉATEUR, intégralement. La commission
 * s'ajoute par-dessus et c'est la marque qui la règle.
 *
 * Auparavant, `amount` était ce que payait la marque et la commission en était
 * déduite : le créateur recevait 270 € sur 300 €, pendant que le produit
 * promettait « 0 % prélevé au créateur ». Les deux conventions laissent à
 * Collabbs la même marge à 45 centimes près ; celle-ci est la seule qui rende
 * la promesse vraie.
 *
 * Les noms restent `gross` / `net` parce qu'ils décrivent exactement les
 * colonnes de `transactions` : `gross_amount` est ce que la marque a payé,
 * `net_amount` ce que le créateur reçoit.
 */
/**
 * La commission Collabbs sur un montant, au centime.
 *
 * ─── Pourquoi une fonction pour une multiplication ───
 * Le calcul existait en DEUX exemplaires — ici et dans le générateur de
 * contrat — et les deux employaient `Math.round`, qui arrondit à l'EURO
 * entier. 10 % de 25 € donnait 3 € et non 2,50 €, alors que l'écran annonce
 * « Commission Collabbs (10 %) » : le montant contredisait son propre libellé.
 * Et l'écart partait toujours du même côté, `Math.round(2.5)` arrondissant
 * vers le haut — toujours en faveur de Collabbs.
 *
 * Les commissions d'affiliation, elles, étaient déjà au centime. Les deux
 * moitiés du produit ne comptaient pas pareil.
 *
 * Le taux est passé en argument et non déduit ici : le contrat doit appliquer
 * le taux FIGÉ au moment de sa signature, pas celui du plan actuel.
 *
 * Constaté le 14/10/2026 en préparant un vrai paiement de test.
 */
export function commissionCollabbs(montant: number, taux: number): number {
  return Math.round(montant * taux * 100) / 100;
}

export function dealBreakdown(
  amount: number,
  plan?: string | null,
): {
  /** Ce que débourse la marque, commission comprise. */
  gross: number;
  /** La commission Collabbs. */
  fee: number;
  /** Ce que reçoit le créateur : le montant convenu, entier. */
  net: number;
} {
  const fee = commissionCollabbs(amount, tauxCollab(plan));
  return { gross: commissionCollabbs(amount + fee, 1), fee, net: amount };
}

/* ─── Les deux formateurs d'euros n'ont plus qu'une implémentation ───

   Ils étaient définis ici, et sept autres fichiers en avaient recopié une
   variante : huit façons d'écrire la même somme, dont deux se croisaient sur
   un même écran (voir l'inventaire dans `lib/euros.ts`). Ils sont désormais
   des NOMS pour la paire unique, gardés parce qu'une vingtaine de fichiers
   les importent et qu'un renommage de masse n'apporterait rien de plus.

   Deux changements visibles par rapport aux anciennes définitions, tous deux
   voulus : l'espace avant l'euro, qu'impose la typographie française, et les
   centimes de `eur` — il écrivait « 1 400,5€ » pour 1 400,50 €.

   `eur` pour un tarif affiché, `eurExact` dès que la somme est due ou réglée. */
export { tarif as eur, montant as eurExact } from "@/lib/euros";

/* ══════════════════════════════════════ comment le créateur est payé ══════

   Le produit ne savait décrire QU'UNE façon de payer une collaboration
   directe : un forfait. Côté campagne il en connaissait six. Une marque qui
   créait une campagne « Fixe + commission » puis allait voir un créateur en
   direct n'avait plus qu'un montant fixe, sans que rien ne le lui explique.

   Deux questions différentes, longtemps mélangées dans une seule liste :
   · le FORMAT dit ce que le créateur produit (vidéo, story, reel…) ;
   · le MODÈLE dit comment il est payé.
   Elles sont indépendantes — une story se paie au forfait, aux vues ou en
   produit — et les garder séparées est ce qui permet de les combiner.        */

export type ModeleRemuneration =
  | "forfait"
  | "performance"
  | "produit"
  | "affiliation"
  | "hybride";

export const MODELES_REMUNERATION: ModeleRemuneration[] = [
  "forfait",
  "affiliation",
  "hybride",
  "performance",
  "produit",
];

/** Les modèles qui font gagner une commission sur les ventes. */
export const MODELES_AVEC_COMMISSION: ModeleRemuneration[] = ["affiliation", "hybride"];

export function avecCommission(modele: ModeleRemuneration): boolean {
  return MODELES_AVEC_COMMISSION.includes(modele);
}

/** Les modèles où la marque verse une somme d'argent au créateur. */
export function avecSommeVersee(modele: ModeleRemuneration): boolean {
  return modele === "forfait" || modele === "hybride" || modele === "performance";
}

export const MODELE_LABEL: Record<ModeleRemuneration, string> = {
  forfait: "Montant fixe",
  affiliation: "Commission sur les ventes",
  hybride: "Fixe + commission",
  performance: "Paiement aux vues",
  produit: "Produit offert",
};

/** Ce que le modèle promet, dit du point de vue du créateur. */
export const MODELE_DESCRIPTION: Record<ModeleRemuneration, string> = {
  forfait: "Une somme convenue d'avance, versée à la livraison validée.",
  affiliation:
    "Pas de fixe : un lien tracké, et un pourcentage sur chaque vente qu'il amène.",
  hybride:
    "Une somme garantie, plus un pourcentage sur les ventes qu'il amène.",
  performance:
    "Un tarif pour 1 000 vues, plafonné. Le créateur déclare ses vues, tu les valides.",
  produit:
    "Pas d'argent : le créateur reçoit un produit. Le contrat vaut quand même, et l'avantage en nature se déclare.",
};

export function modeleValide(valeur: string | null | undefined): ModeleRemuneration {
  return (MODELES_REMUNERATION as string[]).includes(valeur ?? "")
    ? (valeur as ModeleRemuneration)
    : "forfait";
}

/**
 * Le montant d'une collaboration ne veut pas dire la même chose selon le
 * modèle, et l'afficher sous le même mot est ce qui fait croire à une marque
 * qu'elle paie un forfait alors qu'elle pose un plafond.
 */
export const LIBELLE_MONTANT: Record<ModeleRemuneration, string> = {
  forfait: "Montant pour le créateur (€)",
  affiliation: "Valeur du produit envoyé, s'il y en a un (€)",
  hybride: "Partie fixe garantie (€)",
  performance: "Plafond que tu acceptes de dépenser (€)",
  produit: "Valeur du produit offert (€)",
};

/**
 * Un montant reste-t-il à fixer ?
 *
 * Écrit ici parce que `amount === 0` a longtemps voulu dire « pas encore
 * fixé » — et qu'avec le produit offert, zéro devient une réponse valable.
 * Confondre les deux afficherait « montant à fixer » sur une collaboration
 * parfaitement complète.
 */
export function montantAFixer(modele: ModeleRemuneration, amount: number): boolean {
  // Ni le produit offert ni l'affiliation pure ne versent d'argent : zéro y est
  // la réponse, pas un champ resté vide.
  return avecSommeVersee(modele) && amount <= 0;
}

/**
 * Une collaboration peut-elle ne rien imposer à livrer ?
 *
 * ─── Ce que ça corrige ───
 * Toute collaboration affichait « Vidéo postée · 1 », y compris une
 * affiliation. Or une affiliation, la plupart du temps, n'impose RIEN : la
 * marque donne un lien et un pourcentage, le créateur publie ce qu'il veut,
 * quand il veut, autant de fois qu'il veut. Annoncer « 1 vidéo postée » sur ce
 * contrat, c'est écrire une obligation dont personne n'a parlé — et le
 * créateur qui n'en publie qu'une pourrait se croire quitte, pendant que la
 * marque en attendait dix.
 *
 * `quantity = 0` exprime cet accord-là : rien n'est dû, tout est permis. Les
 * autres modèles achètent un travail précis et gardent leur compte.
 */
export function contenuLibre(modele: ModeleRemuneration, quantity: number): boolean {
  return modele === "affiliation" && quantity <= 0;
}
