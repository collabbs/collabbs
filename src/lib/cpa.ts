/**
 * Rémunération à l'action (CPA).
 *
 * Deux modèles, tels qu'ils sont présentés au créateur dans l'interface :
 *
 *  - **`cpa_flat`** — « Tu touches 2 € pour chaque inscription déclarée via
 *    ton lien. » Un montant par action, sans seuil.
 *
 *  - **`cpa_tiers`** — « Dès 1 000 inscriptions → 150 € ». Chaque palier
 *    affiche un montant à lui seul. Le créateur touche donc le montant du
 *    palier le PLUS ÉLEVÉ qu'il a franchi, et non la somme des paliers : un
 *    palier remplace le précédent, il ne s'y ajoute pas. C'est la lecture que
 *    l'interface impose, et c'est elle qui fait foi — un créateur ne peut pas
 *    être payé autrement que ce qu'on lui a montré.
 *
 * Le calcul est volontairement CUMULATIF plutôt qu'incrémental : on recalcule
 * à chaque déclaration ce que le créateur a gagné au total, puis on n'ajoute
 * que la différence avec ce qui lui a déjà été crédité. Un postback rejoué,
 * un palier franchi entre deux déclarations, une action annulée : tout se
 * rattrape de lui-même, sans état intermédiaire à maintenir juste.
 */

export type CpaTier = {
  min_actions: number;
  payout: number;
  label?: string | null;
};

export type CpaCampaign = {
  type: string;
  cpa_value_per_action: number | null;
};

/** Arrondi au centime — jamais à l'euro : une action peut valoir 0,50 €. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Ce que le créateur a gagné AU TOTAL pour un nombre cumulé d'actions.
 * Renvoie 0 si la campagne n'est pas au CPA ou n'est pas configurée.
 */
export function cpaTotalFor(
  campaign: CpaCampaign,
  tiers: CpaTier[],
  cumulativeActions: number,
): number {
  if (cumulativeActions <= 0) return 0;

  if (campaign.type === "cpa_flat") {
    const parAction = campaign.cpa_value_per_action;
    if (!parAction || parAction <= 0) return 0;
    return round2(cumulativeActions * parAction);
  }

  if (campaign.type === "cpa_tiers") {
    // Le palier le plus élevé effectivement franchi. On ne suppose pas que la
    // liste est triée : elle vient de la base.
    const franchis = tiers.filter((t) => t.min_actions > 0 && cumulativeActions >= t.min_actions);
    if (franchis.length === 0) return 0;
    return round2(Math.max(...franchis.map((t) => t.payout)));
  }

  return 0;
}

/**
 * Ce qu'il reste à créditer après une nouvelle déclaration d'actions.
 *
 * `dejaCredite` est la somme des commissions déjà enregistrées pour ce lien
 * sur cette campagne. La différence peut être nulle — des actions
 * supplémentaires sans palier franchi ne rapportent rien de plus en
 * `cpa_tiers`, et c'est exactement ce que l'interface annonce.
 *
 * Elle ne peut jamais être négative : on ne reprend pas au créateur ce qui lui
 * a déjà été crédité. Un tel écart signale une correction à la baisse
 * (actions annulées, palier retiré) et se traite à part, pas en silence.
 */
export function cpaIncrement(
  campaign: CpaCampaign,
  tiers: CpaTier[],
  cumulativeActions: number,
  dejaCredite: number,
): number {
  const total = cpaTotalFor(campaign, tiers, cumulativeActions);
  return round2(Math.max(0, total - dejaCredite));
}

/** Libellé du palier atteint, pour les notifications. */
export function cpaTierLabel(tiers: CpaTier[], cumulativeActions: number): string | null {
  const franchis = tiers
    .filter((t) => t.min_actions > 0 && cumulativeActions >= t.min_actions)
    .sort((a, b) => b.payout - a.payout);
  return franchis[0]?.label ?? null;
}

/**
 * Met un libellé d'action au pluriel.
 *
 * Le libellé est saisi librement par la marque — « inscription », « devis »,
 * « essai gratuit », parfois déjà au pluriel. On applique la règle française
 * ordinaire, en laissant intacts les mots qui ne la suivent pas : ceux qui se
 * terminent déjà par s, x ou z sont invariables.
 *
 * Cette prudence vaut mieux que l'inverse : on a déjà écrit « réseaux
 * sociauxs » dans un contrat faute de l'avoir prise.
 */
export function pluralizeAction(label: string, n: number): string {
  const mot = label.trim();
  if (n <= 1 || !mot) return mot;
  // Une locution — « essai gratuit », « devis en ligne » — ne se met pas au
  // pluriel mot par mot de façon fiable : « essai gratuits » serait faux, et
  // « devis en lignes » pire encore. On la laisse telle quelle plutôt que de
  // fabriquer une faute.
  if (/\s/.test(mot)) return mot;
  if (/[sxz]$/i.test(mot)) return mot;          // devis, choix : invariables
  if (/(au|eu)$/i.test(mot)) return mot + "x";  // jeu → jeux
  if (/al$/i.test(mot)) return mot.slice(0, -2) + "aux"; // signal → signaux
  return mot + "s";
}
