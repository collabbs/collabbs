/**
 * La fenêtre d'attribution.
 *
 * ─── Ce qu'elle est ───
 * La durée pendant laquelle un clic reste attribuable à une vente. Quelqu'un
 * clique sur le lien d'un créateur, revient acheter trois jours plus tard : la
 * commission est due. S'il revient dix-huit mois plus tard, elle ne l'est
 * plus — la vente n'est plus le fait du créateur.
 *
 * ─── Pourquoi ce fichier existe ───
 * La colonne `campaigns.attribution_days` est en base depuis la migration
 * 0040, avec sa valeur par défaut, sa contrainte, et un commentaire qui
 * explique très bien à quoi elle sert. **Aucun code ne la lisait.** Le script
 * de suivi figeait la fenêtre à trente jours en dur et le postback de vente ne
 * vérifiait rien du tout : une marque au cycle d'achat long ne pouvait pas
 * l'allonger, et une vente très postérieure au clic se réglait automatiquement
 * sans que personne ne s'en aperçoive.
 *
 * ─── Ce qu'on fait d'une vente hors fenêtre ───
 * On ne la refuse pas. Refuser ferait disparaître de l'argent dû à un créateur
 * sur la foi d'une date fournie par le navigateur du client — et une date
 * absente ou fausse ne doit jamais coûter une commission à quelqu'un.
 *
 * On la fait basculer vers la revue de la marque, exactement comme une vente
 * déclarée par pixel : elle est enregistrée, visible, et n'engage aucun argent
 * tant que la marque n'a pas confirmé. C'est elle qui a la commande sous les
 * yeux, pas nous.
 */

/** La fenêtre appliquée quand la campagne n'en fixe aucune. Standard du secteur. */
export const FENETRE_PAR_DEFAUT = 30;

/** Les bornes de la contrainte CHECK posée en base par la migration 0040. */
export const FENETRE_MIN = 1;
export const FENETRE_MAX = 365;

/**
 * Ramène une valeur venue de la base ou d'un formulaire à une fenêtre valable.
 *
 * Une campagne créée avant la migration, une colonne nulle, une saisie
 * aberrante : tous ces cas donnent la valeur par défaut plutôt qu'une
 * exception ou un zéro. Une fenêtre à zéro rejetterait absolument toutes les
 * ventes — l'erreur la plus coûteuse que ce fichier puisse produire.
 */
export function fenetreValide(jours: number | null | undefined): number {
  if (jours == null || !Number.isFinite(jours)) return FENETRE_PAR_DEFAUT;
  const entier = Math.round(jours);
  if (entier < FENETRE_MIN || entier > FENETRE_MAX) return FENETRE_PAR_DEFAUT;
  return entier;
}

/**
 * Cette vente tombe-t-elle en dehors de la fenêtre ?
 *
 * Renvoie `false` — donc « dans la fenêtre » — dans tous les cas douteux :
 * date de clic absente, illisible, ou postérieure à la vente. Le doute ne doit
 * jamais jouer contre le créateur, parce que c'est lui qui perdrait sa
 * commission alors qu'il n'a aucun moyen d'agir sur la donnée en cause.
 *
 * Un clic postérieur à la vente n'est pas un cas d'école : les horloges des
 * navigateurs sont réglées par leurs propriétaires, et certaines ont des mois
 * d'avance.
 */
export function horsFenetre(
  clicISO: string | null | undefined,
  venteISO: string,
  jours: number,
): boolean {
  if (!clicISO) return false;
  const clic = Date.parse(clicISO);
  const vente = Date.parse(venteISO);
  if (!Number.isFinite(clic) || !Number.isFinite(vente)) return false;
  const ecartJours = (vente - clic) / 86_400_000;
  if (ecartJours < 0) return false;
  return ecartJours > fenetreValide(jours);
}

/**
 * La phrase mise sur la vente envoyée en revue, pour que la marque comprenne
 * pourquoi on la lui présente plutôt que de la régler.
 */
export function motifHorsFenetre(
  clicISO: string,
  venteISO: string,
  jours: number,
): string {
  const ecart = Math.floor((Date.parse(venteISO) - Date.parse(clicISO)) / 86_400_000);
  return `Vente ${ecart} jours après le clic, au-delà de la fenêtre d'attribution de ${fenetreValide(jours)} jours.`;
}
