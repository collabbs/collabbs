/**
 * Les partenariats récurrents — « ambassadeur ».
 *
 * Une marque et un créateur s'engagent sur plusieurs mois : X contenus par
 * mois, un montant mensuel. C'est le format qui manquait, et c'est celui qui
 * change le métier du créateur — un revenu prévisible au lieu d'une suite de
 * coups.
 *
 * ─── La décision d'architecture, et elle décide de tout ───
 * **Un engagement ne transporte pas d'argent. Il crée des collaborations.**
 * Chaque mois, il ouvre une collaboration ordinaire, avec son séquestre, son
 * contrat, sa livraison et son versement. Aucun troisième circuit à côté du
 * séquestre et de la provision : le mois d'un ambassadeur emprunte exactement
 * le chemin d'une collaboration isolée.
 *
 * ─── On ne séquestre pas douze mois d'avance ───
 * Immobiliser 4 800 € pour un an bloquerait la trésorerie de la marque, et
 * personne ne signerait. Chaque mois se paie à son tour. Ce qui a une
 * conséquence qu'il faut assumer et dire aux deux parties : **l'engagement est
 * un plan, pas une dette.** Le créateur n'a pas douze mois garantis en banque ;
 * il a une intention, un préavis, et une trace. C'est déjà beaucoup plus que ce
 * qu'il obtient ailleurs, mais ce n'est pas un salaire.
 */

/** Durées d'engagement proposées, en mois. */
export const DUREES_ENGAGEMENT = [3, 6, 12] as const;

/** Préavis par défaut avant de pouvoir rompre, en jours. */
export const PREAVIS_JOURS = 30;

export type StatutEngagement = "active" | "ended";

/**
 * Ajoute des mois à une date, sans déborder sur le mois suivant.
 *
 * `new Date(2026, 0, 31)` + 1 mois donne le 3 mars en JavaScript : le 31
 * février n'existe pas, et l'objet Date déborde en silence. Pour un
 * planificateur de paiements, ce débordement décalerait une échéance d'un mois
 * entier. On ramène donc au dernier jour du mois visé.
 */
export function ajouterMois(depart: string, mois: number): string {
  const d = new Date(depart);
  const jour = d.getUTCDate();
  const cible = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + mois, 1, 12, 0, 0),
  );
  const dernierJour = new Date(
    Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0, 12, 0, 0),
  ).getUTCDate();
  cible.setUTCDate(Math.min(jour, dernierJour));
  return cible.toISOString();
}

/**
 * L'échéance du prochain mois à ouvrir.
 *
 * Le mois 1 s'ouvre le jour de la signature, le mois 2 un mois après, et ainsi
 * de suite. `moisCrees` compte ce qui a DÉJÀ été ouvert : c'est donc lui,
 * et pas la date du jour, qui détermine la prochaine échéance. Un automate qui
 * n'aurait pas tourné pendant trois jours rattrape son retard au lieu de sauter
 * un mois.
 */
export function prochaineEcheance(debut: string, moisCrees: number): string {
  return ajouterMois(debut, moisCrees);
}

/** Reste-t-il des mois à ouvrir ? */
export function moisRestants(moisTotal: number, moisCrees: number): number {
  return Math.max(0, moisTotal - moisCrees);
}

/**
 * Faut-il ouvrir la collaboration du mois suivant ?
 *
 * Trois conditions, et les trois comptent : l'engagement est actif, il reste
 * des mois, et l'échéance est arrivée. Sans la deuxième, un engagement de six
 * mois continuerait d'ouvrir des collaborations la septième année.
 */
export function doitOuvrirLeMois(
  engagement: {
    status: string;
    months_total: number;
    months_created: number;
    starts_at: string;
  },
  maintenant: string,
): boolean {
  if (engagement.status !== "active") return false;
  if (moisRestants(engagement.months_total, engagement.months_created) <= 0) return false;
  return new Date(prochaineEcheance(engagement.starts_at, engagement.months_created)) <= new Date(maintenant);
}

/**
 * Ce que coûte l'engagement en tout, si les deux parties vont au bout.
 *
 * Affiché avant signature. C'est le chiffre que la marque doit avoir en tête —
 * pas le montant mensuel, qui fait paraître l'engagement plus petit qu'il n'est.
 */
export function coutTotal(montantMensuel: number, moisTotal: number): number {
  return Math.max(0, Math.round(montantMensuel)) * Math.max(0, Math.round(moisTotal));
}

/**
 * Résumé lisible : « 6 mois · 2 contenus/mois · 400 €/mois ».
 *
 * Le total n'y figure pas volontairement : cette phrase sert d'étiquette dans
 * des listes, et le total mérite d'être montré à part, en gras, là où la
 * décision se prend.
 */
export function libelleEngagement(
  moisTotal: number,
  contenusParMois: number,
  montantMensuel: number,
): string {
  const contenus = contenusParMois > 1 ? `${contenusParMois} contenus/mois` : "1 contenu/mois";
  return `${moisTotal} mois · ${contenus} · ${montantMensuel.toLocaleString("fr-FR")}€/mois`;
}

/**
 * La date à partir de laquelle une rupture prend effet.
 *
 * Le préavis protège les DEUX parties, et c'est la seule raison d'être de cette
 * fonction : sans lui, une marque pourrait couper la veille du tournage d'un
 * créateur qui a déjà refusé d'autres contrats pour elle, et un créateur
 * pourrait disparaître au milieu d'une campagne construite autour de lui.
 *
 * Les collaborations DÉJÀ ouvertes ne sont pas touchées : elles ont un contrat
 * signé et parfois un séquestre. Rompre l'engagement empêche d'en ouvrir de
 * nouvelles, il n'annule pas ce qui est en cours.
 */
export function finDuPreavis(demandeLe: string, jours = PREAVIS_JOURS): string {
  const d = new Date(demandeLe);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString();
}
