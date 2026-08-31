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
  const fee = Math.round(amount * tauxCollab(plan));
  return { gross: amount + fee, fee, net: amount };
}

export const eur = (n: number) => `${n.toLocaleString("fr-FR")}€`;

/**
 * Montant financier, toujours au centime : 12 → "12,00€", 562.5 → "562,50€".
 * À utiliser partout où l'on montre de l'argent réellement dû ou versé
 * (provision, registre, commissions, versements). `eur` reste pour les
 * tarifs affichés, où "300€" se lit mieux que "300,00€".
 */
export const eurExact = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;
