// Helpers partagés pour l'affichage des campagnes (côté créateur et marque).

/**
 * Les types de campagne réellement créables par le formulaire.
 *
 * Cette liste avait divergé de celle de `campaigns/actions.ts` : les deux
 * types CPA y manquaient. Comme le type interdisait leur existence, personne
 * ne voyait que `CAMPAIGN_TYPE_LABEL` renvoyait `undefined` et que
 * `campaignReward` renvoyait « — » pour ces campagnes. La première campagne
 * au CPA créée serait tombée sur une page sans intitulé ni rémunération.
 */
export type CampaignType =
  | "affiliation"
  | "video"
  | "performance"
  | "hybrid"
  | "cpa_flat"
  | "cpa_tiers";

/**
 * Ramène n'importe quelle valeur venue de la base à un type connu.
 *
 * L'énumération PostgreSQL `campaign_type` contient une valeur de plus que
 * cette liste — `giveaway` — qu'aucun formulaire ne crée. Les deux écrans qui
 * lisent le type font `c.type as CampaignType` : un transtypage qui affirme
 * quelque chose que la base ne garantit pas. Une seule ligne avec cette
 * valeur, créée à la main ou par une migration future, et
 * `CAMPAIGN_TYPE_LABEL[type]` renvoie `undefined` : la campagne s'affiche
 * sans intitulé et sans rémunération.
 *
 * C'est exactement le bug documenté en haut de ce fichier, celui des deux
 * types CPA absents. Il avait échappé au compilateur pour la même raison. On
 * le referme ici plutôt que d'attendre qu'il se reproduise.
 */
export function typeDeCampagne(valeur: string | null | undefined): CampaignType {
  return (CAMPAIGN_TYPES as readonly string[]).includes(valeur ?? "")
    ? (valeur as CampaignType)
    : "video";
}

/** Les types connus, à l'exécution — le type TypeScript seul ne s'exporte pas en liste. */
export const CAMPAIGN_TYPES = [
  "affiliation",
  "video",
  "performance",
  "hybrid",
  "cpa_flat",
  "cpa_tiers",
] as const satisfies readonly CampaignType[];

export const CAMPAIGN_TYPE_LABEL: Record<CampaignType, string> = {
  affiliation: "Affiliation",
  video: "Paiement fixe",
  performance: "Performance",
  hybrid: "Hybride",
  cpa_flat: "Paiement à l'action",
  cpa_tiers: "Paliers à l'action",
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
  cpa_flat:
    "Tu touches un montant fixe pour chaque action réalisée via ton lien — une inscription, un essai, un devis.",
  cpa_tiers:
    "Plus tu génères d'actions, plus tu montes de palier. Chaque palier atteint remplace le précédent.",
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
  cpa_value_per_action?: number | null;
  cpa_action_label?: string | null;
  campaign_cpa_tiers?: { payout: number }[] | null;
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
    case "cpa_flat":
      return c.cpa_value_per_action
        ? `${c.cpa_value_per_action}€ par ${c.cpa_action_label || "action"}`
        : "Paiement à l'action";
    case "cpa_tiers": {
      // On annonce le palier le plus haut : c'est le maximum atteignable, et
      // c'est ce qui donne envie de s'engager. Le détail des paliers est
      // affiché juste en dessous sur la page.
      const paliers = (c.campaign_cpa_tiers ?? []).map((t) => t.payout);
      return paliers.length > 0
        ? `Jusqu'à ${Math.max(...paliers).toLocaleString("fr-FR")}€ par paliers`
        : "Paliers à l'action";
    }
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

/**
 * De quoi un créateur a-t-il besoin pour participer à cette campagne ?
 *
 * Le produit répondait à cette question avec un seul booléen — « est-ce de
 * l'affiliation ? » — et se trompait deux fois :
 *
 *  · **L'hybride** promet un forfait ET une commission. Le créateur ne voyait
 *    que « active ton lien » : aucun chemin ne menait à la collaboration qui
 *    verse le forfait. Le fixe était affiché et impayable.
 *  · **Le CPA** rémunère des actions suivies par un lien. L'écran proposait
 *    « candidater », ce qui aurait créé une collaboration à 0 € — et aucun
 *    lien, donc aucune action mesurable.
 *
 * Les deux besoins ne s'excluent pas : sur une campagne hybride, le créateur
 * active son lien et candidate.
 */
export function besoinLienDeSuivi(type: string, avecCodePromo = false): boolean {
  return (
    type === "affiliation" ||
    type === "hybrid" ||
    type === "cpa_flat" ||
    type === "cpa_tiers" ||
    // Un code promo se rattache au lien du créateur : sans lien, pas de code.
    avecCodePromo
  );
}

/** Une candidature n'a de sens que si une collaboration doit naître. */
export function besoinCandidature(type: string): boolean {
  return type === "video" || type === "performance" || type === "hybrid";
}
