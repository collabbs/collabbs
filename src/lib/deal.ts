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

// Commission plateforme sur les deals (cf. modèle éco : 10%).
export const PLATFORM_FEE_RATE = 0.1;

export function dealBreakdown(amount: number): {
  gross: number;
  fee: number;
  net: number;
} {
  const fee = Math.round(amount * PLATFORM_FEE_RATE);
  return { gross: amount, fee, net: amount - fee };
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
