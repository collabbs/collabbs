// Helpers partagés pour l'affichage des campagnes (côté créateur et marque).

export type CampaignType = "affiliation" | "video" | "performance" | "hybrid";

export const CAMPAIGN_TYPE_LABEL: Record<CampaignType, string> = {
  affiliation: "Affiliation",
  video: "Paiement fixe",
  performance: "Performance",
  hybrid: "Hybride",
};

export const CAMPAIGN_TYPE_DESCRIPTION: Record<CampaignType, string> = {
  affiliation:
    "Tu touches une commission sur chaque vente générée par ton lien unique. Aucun plafond.",
  video:
    "La marque te paie un montant fixe par contenu livré, quel que soit le résultat.",
  performance:
    "Tu es rémunéré·e selon les performances réelles (vues, clics) de ton contenu.",
  hybrid:
    "Un montant fixe garanti, plus une commission sur les ventes générées.",
};

export const TONE_LABEL: Record<string, string> = {
  authentic: "Authentique",
  educational: "Pédagogique",
  testimonial: "Témoignage",
};

type RewardInput = {
  type: string;
  fixed_amount?: number | null;
  commission_value?: number | null;
  commission_unit?: string | null;
  commission_nano?: number | null;
  commission_macro?: number | null;
};

/** Formule de rémunération lisible pour une campagne. */
export function campaignReward(c: RewardInput): string {
  switch (c.type) {
    case "affiliation":
      return `Commission ${c.commission_nano ?? "?"}%–${c.commission_macro ?? "?"}%`;
    case "video":
      return c.fixed_amount ? `${c.fixed_amount}€ par contenu` : "Paiement fixe";
    case "performance":
      return c.commission_value
        ? `${c.commission_value}€ / 1000 ${c.commission_unit ?? "vues"}`
        : "À la performance";
    case "hybrid":
      return `${c.fixed_amount ?? 0}€ + commission ${c.commission_nano ?? "?"}–${c.commission_macro ?? "?"}%`;
    default:
      return "—";
  }
}

export const eur = (n: number) => `${n.toLocaleString("fr-FR")}€`;

/** Paliers de commission par taille d'audience (affiliation / hybride). */
export const TIER_LABELS: { key: "nano" | "micro" | "mid" | "macro"; label: string }[] = [
  { key: "nano", label: "Nano · < 10k" },
  { key: "micro", label: "Micro · 10–50k" },
  { key: "mid", label: "Mid · 50–200k" },
  { key: "macro", label: "Macro · 200k+" },
];
